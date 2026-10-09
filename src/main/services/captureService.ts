import type { CaptureErrorCode } from '@shared/captures'
import type { CaptureMethod } from '@shared/model'
import { classifyBlock } from '../domain/blockClassification'
import { DomainError } from '../domain/errors'
import { toElementDrafts } from '../extraction/elementDrafts'
import type { ExtractItem } from '../extraction/types'
import type { CaptureRow } from '../repositories/captureRepository'
import { toDomainElement } from '../repositories/elementRepository'
import { inTransaction, notifySafely, type ServiceDeps } from './deps'

/**
 * 먹이(Capture)의 상태 변경과 추출 결과 반영. (설계 8장)
 * 원문은 다루지 않는다. 원문 보관·추출기 호출·재시도 시점은 추출 큐가 맡고, 이 서비스를 호출한다.
 *
 * 상태 변경은 모두 "지금 상태가 X일 때만"으로 한다. 같은 Capture를 두 번 처리하려 해도
 * 두 번째는 상태가 맞지 않아 실패한다. (설계 8.7 중복 처리 방지)
 */
export class CaptureService {
  constructor(private readonly deps: ServiceDeps) {}

  find(captureId: string): CaptureRow | undefined {
    return inTransaction(this.deps, (repos) => repos.captures.findById(captureId))
  }

  /** 먹이를 받는다. pending으로 만든다. sourceApp은 7단계 전까지 null (설계 6.2) */
  create(method: CaptureMethod): CaptureRow {
    return inTransaction(this.deps, (repos) => {
      const id = this.deps.newId()
      repos.captures.insert({
        id,
        method,
        sourceApp: null,
        status: 'pending',
        errorCode: null,
        capturedAt: this.deps.now()
      })
      return mustFind(repos.captures.findById(id), id)
    })
  }

  /** 큐에서 꺼낼 때: pending → extracting. 이미 다른 곳에서 처리 중이면 false */
  startExtracting(captureId: string): boolean {
    return inTransaction(this.deps, (repos) =>
      repos.captures.transition(captureId, ['pending'], 'extracting', null)
    )
  }

  /** 자동 재시도를 기다릴 때: extracting → pending (설계 8.7) */
  waitForRetry(captureId: string): boolean {
    return inTransaction(this.deps, (repos) =>
      repos.captures.transition(captureId, ['extracting'], 'pending', null)
    )
  }

  /**
   * 추출 성공: item마다 블록 하나를 만들고 Capture를 done으로 바꾼다. (설계 8.6)
   * 블록 전부와 상태 변경이 한 트랜잭션이다. 커밋 후 blocks:changed, 이어서 capture:completed
   * (캘린더로 간 수·채워 주세요로 간 수 포함, 설계 8.1).
   * items가 비어 있으면(할 일 없음) 블록 없이 done.
   * @returns 만든 블록 ID (item 순서)
   */
  complete(captureId: string, items: readonly ExtractItem[]): string[] {
    const { blockIds, needsInput } = inTransaction(this.deps, (repos, changes) => {
      if (!repos.captures.transition(captureId, ['extracting'], 'done', null)) {
        throw new DomainError('CAPTURE_NOT_FOUND', `처리 중인 먹이가 없습니다: ${captureId}`)
      }
      const at = this.deps.now()
      const created: string[] = []
      let toFill = 0

      for (const item of items) {
        const drafts = toElementDrafts(item)
        if (drafts.length === 0) continue

        const blockId = this.deps.newId()
        repos.blocks.insert(blockId, at)
        repos.history.record(
          {
            entityType: 'block',
            entityId: blockId,
            action: 'block.created',
            before: null,
            after: { ...repos.blocks.findLiveById(blockId), captureId }
          },
          at
        )

        drafts.forEach((draft, orderIndex) => {
          const elementId = this.deps.newId()
          repos.elements.insert({
            id: elementId,
            blockId,
            ...draft,
            captureId,
            orderIndex,
            createdAt: at,
            updatedAt: at
          })
          repos.history.record(
            {
              entityType: 'element',
              entityId: elementId,
              action: 'element.created',
              before: null,
              after: { ...repos.elements.findLiveById(elementId) }
            },
            at
          )
        })

        changes.add(blockId)
        created.push(blockId)
        // 새 블록은 이대로 두기 전이라 빠진 것이 하나라도 있으면 채워 주세요로 간다 (설계 7.6)
        const elements = repos.elements.findLiveByBlock(blockId).map(toDomainElement)
        if (classifyBlock(elements, false).needsInput) toFill += 1
      }
      return { blockIds: created, needsInput: toFill }
    })

    notifySafely('captureCompleted', () =>
      this.deps.notifier.captureCompleted({
        captureId,
        blockIds,
        toCalendar: blockIds.length - needsInput,
        needsInput
      })
    )
    return blockIds
  }

  /**
   * 추출 실패: pending·extracting → failed. 커밋 후 capture:failed.
   * canRetry는 원문이 메모리에 남는지에 달려 있어 큐가 넘겨준다.
   * @returns 바꿨는지. 이미 끝났거나 닫힌 먹이면 false이고 알리지 않는다.
   */
  fail(captureId: string, errorCode: CaptureErrorCode, canRetry: boolean): boolean {
    const failed = inTransaction(this.deps, (repos) =>
      repos.captures.transition(captureId, ['pending', 'extracting'], 'failed', errorCode)
    )
    if (failed) {
      notifySafely('captureFailed', () =>
        this.deps.notifier.captureFailed({ captureId, errorCode, canRetry })
      )
    }
    return failed
  }

  /**
   * 수동 다시 시도: failed → pending, errorCode를 비운다. (설계 8.7)
   * 원문이 메모리에 있는지는 큐가 먼저 확인한다.
   * 연달아 호출하면 두 번째는 이미 pending이라 CAPTURE_NOT_RETRYABLE.
   */
  markRetrying(captureId: string): CaptureRow {
    return inTransaction(this.deps, (repos) => {
      const row = repos.captures.findById(captureId)
      if (!row) throw new DomainError('CAPTURE_NOT_FOUND', `먹이가 없습니다: ${captureId}`)
      if (!repos.captures.transition(captureId, ['failed'], 'pending', null)) {
        throw new DomainError(
          'CAPTURE_NOT_RETRYABLE',
          `실패한 먹이가 아닙니다: ${captureId} (${row.status})`
        )
      }
      return mustFind(repos.captures.findById(captureId), captureId)
    })
  }

  /**
   * 앱 시작 시: 처리 중이던 먹이를 failed(INTERRUPTED)로 바꾼다. (설계 8.2)
   * 창이 뜨기 전이므로 알리지 않는다. 창은 listFailed로 조회한다.
   * @returns 바꾼 개수
   */
  interruptUnfinished(): number {
    return inTransaction(this.deps, (repos) => repos.captures.failUnfinished('INTERRUPTED'))
  }

  /** 실패 카드 목록 (먹인 순) */
  listFailed(): CaptureRow[] {
    return inTransaction(this.deps, (repos) => repos.captures.findFailed())
  }

  /** 실패 카드 닫기: failed인 Capture를 지운다. 실패한 먹이가 아니면 CAPTURE_NOT_FOUND */
  dismiss(captureId: string): void {
    inTransaction(this.deps, (repos) => {
      if (!repos.captures.deleteFailed(captureId)) {
        throw new DomainError('CAPTURE_NOT_FOUND', `실패한 먹이가 없습니다: ${captureId}`)
      }
    })
  }
}

function mustFind(row: CaptureRow | undefined, id: string): CaptureRow {
  if (!row) throw new Error(`Capture를 저장한 뒤 찾지 못했습니다: ${id}`)
  return row
}
