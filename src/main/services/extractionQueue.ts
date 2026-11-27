import type { CaptureView } from '@shared/captures'
import type { CaptureMethod } from '@shared/model'
import { DomainError } from '../domain/errors'
import { ExtractError } from '../extraction/errors'
import { parseExtractOutput } from '../extraction/parseOutput'
import type { ExtractItem, Extractor } from '../extraction/types'
import type { CaptureService } from './captureService'
import { notifySafely, type ChangeNotifier } from './deps'
import { toCaptureView } from './views'

/** 자동 재시도 간격. 길이가 최대 재시도 횟수다. (설계 8.7) */
export const AUTO_RETRY_DELAYS_MS = [2_000, 10_000, 30_000] as const

export type ExtractionQueueOptions = {
  captures: CaptureService
  extractor: Extractor
  /** 예: "Asia/Seoul". 앱에서는 PC 설정을 읽어 넘긴다 (설계 8.1) */
  timezone: string
  /** 미완료 먹이 수가 바뀌면 알린다 (설계 9.4) */
  notifier: Pick<ChangeNotifier, 'captureUnfinishedChanged'>
  retryDelaysMs?: readonly number[]
}

/** 메모리에만 두는 먹이 정보. 원문은 DB에 저장하지 않는다. (설계 8.2) */
type MemoryEntry = { text: string; capturedAt: string }

/**
 * 추출 큐. (설계 8.1, 8.2, 8.7)
 * - 원문을 메모리에만 보관한다. 성공하거나 실패 카드를 닫으면 지운다. 실패해도 앱이 켜져 있는 동안은 남긴다.
 * - 한 번에 하나씩, 들어온 순서대로 추출기를 부른다.
 * - 재시도 가능한 실패는 간격을 두고 다시 넣는다. 기다리는 동안 큐는 다음 먹이를 처리한다.
 *
 * 중복 처리 방지: 같은 ID는 큐에 한 번만 들어가고, 꺼낼 때 pending → extracting 전환이
 * 성공해야만 처리한다. 상태가 맞지 않는 늦은 재시도나 중복 요청은 그 자리에서 버려진다.
 *
 * 미완료 먹이 수(대기 + 처리 중 + 자동 재시도 대기)는 이 큐가 기준이다. 어느 창에서 먹였든,
 * 수동 다시 시도든 자동 재시도든 수가 실제로 바뀔 때만 capture:unfinishedChanged를 보낸다.
 */
export class ExtractionQueue {
  private readonly captures: CaptureService
  private readonly extractor: Extractor
  private readonly timezone: string
  private readonly retryDelaysMs: readonly number[]
  private readonly notifier: Pick<ChangeNotifier, 'captureUnfinishedChanged'>

  private readonly memory = new Map<string, MemoryEntry>()
  private readonly waiting: string[] = []
  private readonly autoRetries = new Map<string, number>()
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private current: string | null = null
  private idle: Promise<void> = Promise.resolve()
  /** 마지막으로 알린 미완료 수. 같은 수는 다시 알리지 않는다 */
  private announcedCount = 0

  constructor(options: ExtractionQueueOptions) {
    this.captures = options.captures
    this.extractor = options.extractor
    this.timezone = options.timezone
    this.retryDelaysMs = options.retryDelaysMs ?? AUTO_RETRY_DELAYS_MS
    this.notifier = options.notifier
  }

  /** 먹이 주기: Capture를 만들고 바로 돌려준다. 추출은 비동기로 이어진다. */
  submit(text: string, method: CaptureMethod): CaptureView {
    const row = this.captures.create(method)
    this.memory.set(row.id, { text, capturedAt: row.capturedAt })
    this.enqueue(row.id)
    return toCaptureView(row, false)
  }

  /**
   * 실패한 먹이 다시 시도. failed이고 원문이 메모리에 있을 때만 된다. (설계 8.7)
   * 자동 재시도 횟수는 처음부터 다시 센다.
   */
  retry(captureId: string): CaptureView {
    if (!this.memory.has(captureId)) {
      if (!this.captures.find(captureId)) {
        throw new DomainError('CAPTURE_NOT_FOUND', `먹이가 없습니다: ${captureId}`)
      }
      throw new DomainError('CAPTURE_NOT_RETRYABLE', `원문이 남아 있지 않습니다: ${captureId}`)
    }
    // 처리 중·자동 재시도 대기 중이면 여기서 CAPTURE_NOT_RETRYABLE
    const row = this.captures.markRetrying(captureId)
    this.autoRetries.delete(captureId)
    this.enqueue(captureId)
    return toCaptureView(row, false)
  }

  /** 실패 카드 목록. 원문이 메모리에 있으면 canRetry */
  listFailed(): CaptureView[] {
    return this.captures.listFailed().map((row) => toCaptureView(row, this.memory.has(row.id)))
  }

  /** 실패 카드 닫기: Capture를 지우고 원문도 버린다. */
  dismiss(captureId: string): void {
    this.captures.dismiss(captureId)
    this.forget(captureId)
  }

  /**
   * 아직 끝나지 않은 먹이 수(대기 + 처리 중 + 자동 재시도 대기).
   * 캐릭터 "먹는 중"(capture:unfinishedCount)과 앱 종료 확인에 쓴다.
   */
  unfinishedCount(): number {
    return this.waiting.length + (this.current === null ? 0 : 1) + this.retryTimers.size
  }

  /** 큐가 빌 때까지 기다린다. 자동 재시도 타이머는 기다리지 않는다. (테스트용) */
  whenIdle(): Promise<void> {
    return this.idle
  }

  private enqueue(captureId: string): void {
    if (this.current === captureId || this.waiting.includes(captureId)) return
    this.waiting.push(captureId)
    if (this.current === null && this.waiting.length === 1) this.idle = this.drain()
    this.announceUnfinished()
  }

  private async drain(): Promise<void> {
    for (let next = this.waiting.shift(); next !== undefined; next = this.waiting.shift()) {
      this.current = next
      try {
        await this.process(next)
      } catch (error) {
        console.error(`[extraction] ${next} 처리 중 오류`, error)
      } finally {
        this.current = null
        // 다음 먹이를 꺼내도 수는 같으므로, 여기서 알리는 수가 곧 안정된 값이다
        this.announceUnfinished()
      }
    }
  }

  private async process(captureId: string): Promise<void> {
    const entry = this.memory.get(captureId)
    // 닫힌 먹이이거나, 이미 다른 경로로 처리 중·처리 끝난 먹이면 건너뛴다
    if (!entry || !this.captures.startExtracting(captureId)) return

    let items: ExtractItem[]
    try {
      const raw = await this.extractor.extract({
        text: entry.text,
        capturedAt: entry.capturedAt,
        timezone: this.timezone
      })
      items = parseExtractOutput(raw)
    } catch (error) {
      this.handleExtractFailure(captureId, error)
      return
    }

    try {
      this.captures.complete(captureId, items)
    } catch (error) {
      // 반영 트랜잭션이 취소됐다. 원문은 남겨 수동으로 다시 시도할 수 있게 한다.
      console.error(`[extraction] ${captureId} 결과 반영 실패`, error)
      this.captures.fail(captureId, 'CAPTURE_EXTRACT_FAILED', true)
      return
    }
    this.forget(captureId)
  }

  private handleExtractFailure(captureId: string, error: unknown): void {
    if (error instanceof ExtractError) {
      // 원인을 터미널에서 볼 수 있게 남긴다. ExtractError 메시지에는 원문을 넣지 않는다 (설계 8.9)
      const kind = error.retryable ? '재시도 가능' : '재시도 안 함'
      console.warn(`[extraction] ${captureId} 추출 실패 (${kind}): ${error.message}`)
    } else {
      console.error(`[extraction] ${captureId} 추출기 오류`, error)
    }
    const retryable = error instanceof ExtractError && error.retryable
    const used = this.autoRetries.get(captureId) ?? 0

    if (retryable && used < this.retryDelaysMs.length) {
      this.autoRetries.set(captureId, used + 1)
      if (!this.captures.waitForRetry(captureId)) return
      const timer = setTimeout(() => {
        this.retryTimers.delete(captureId)
        this.enqueue(captureId)
        this.announceUnfinished()
      }, this.retryDelaysMs[used])
      this.retryTimers.set(captureId, timer)
      return
    }

    this.autoRetries.delete(captureId)
    this.captures.fail(captureId, 'CAPTURE_EXTRACT_FAILED', true)
  }

  private forget(captureId: string): void {
    this.memory.delete(captureId)
    this.autoRetries.delete(captureId)
    const timer = this.retryTimers.get(captureId)
    if (timer !== undefined) clearTimeout(timer)
    this.retryTimers.delete(captureId)
    this.announceUnfinished()
  }

  /** 미완료 수가 지난번에 알린 수와 다를 때만 알린다 (설계 9.4) */
  private announceUnfinished(): void {
    const count = this.unfinishedCount()
    if (count === this.announcedCount) return
    this.announcedCount = count
    notifySafely('captureUnfinishedChanged', () =>
      this.notifier.captureUnfinishedChanged({ count })
    )
  }
}
