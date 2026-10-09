import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ExtractError } from '../extraction/errors'
import type { ExtractOutput, Extractor } from '../extraction/types'
import { CaptureService } from './captureService'
import { ExtractionQueue } from './extractionQueue'
import { expectDomainError, setupServiceTest, type ServiceTestContext } from './testSupport'

function output(...tasks: string[]): ExtractOutput {
  return {
    schemaVersion: 1,
    notTask: tasks.length === 0,
    items: tasks.map((task) => ({
      task,
      detail: null,
      requester: null,
      startDate: null,
      dueDate: null
    }))
  }
}

const networkError = (): ExtractError => new ExtractError('network', true)
const badOutputError = (): ExtractError => new ExtractError('bad output', false)

/** 테스트가 직접 끝내는 추출 (처리 중 상태를 붙잡아 두기 위해) */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('ExtractionQueue (설계 8.7)', () => {
  let ctx: ServiceTestContext
  let captures: CaptureService
  let extract: Mock<Extractor['extract']>
  let queue: ExtractionQueue

  beforeEach(() => {
    vi.useFakeTimers()
    ctx = setupServiceTest()
    captures = new CaptureService(ctx.deps)
    extract = vi.fn<Extractor['extract']>()
    queue = new ExtractionQueue({
      captures,
      extractor: { extract },
      timezone: 'Asia/Seoul',
      notifier: ctx.notifier
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    ctx.connection.close()
  })

  /** 추출 결과 이벤트만 (미완료 수 이벤트는 따로 확인한다) */
  function resultEvents(): typeof ctx.notifier.events {
    return ctx.notifier.events.filter((e) => e.event !== 'capture:unfinishedChanged')
  }

  /** 알린 미완료 수를 순서대로 */
  function announcedCounts(): number[] {
    return ctx.notifier.events.flatMap((e) =>
      e.event === 'capture:unfinishedChanged' ? [e.payload.count] : []
    )
  }

  /** 시간을 ms만큼 흘리고 큐가 빌 때까지 기다린다 */
  async function settle(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms)
    await queue.whenIdle()
  }

  function status(captureId: string): string | undefined {
    return captures.find(captureId)?.status
  }

  function blockCount(): number {
    return ctx.repos.blocks.list('all').length
  }

  describe('처리 흐름', () => {
    it('submit은 pending으로 바로 돌려주고, 추출이 끝나면 블록을 만든다', async () => {
      extract.mockResolvedValueOnce(output('견적서 송부'))

      const view = queue.submit('견적서 송부해주세요', 'paste')

      expect(view).toMatchObject({
        status: 'pending',
        method: 'paste',
        errorCode: null,
        canRetry: false
      })
      await settle()
      expect(status(view.id)).toBe('done')
      expect(blockCount()).toBe(1)
      expect(extract).toHaveBeenCalledWith({
        text: '견적서 송부해주세요',
        capturedAt: view.capturedAt,
        timezone: 'Asia/Seoul'
      })
      expect(resultEvents().at(-1)).toMatchObject({
        event: 'capture:completed',
        payload: { captureId: view.id }
      })
    })

    it('원문은 성공하면 메모리에서 지우고 DB에 남기지 않는다', async () => {
      extract.mockResolvedValueOnce(output('견적서'))

      const { id } = queue.submit('비밀 원문 XYZ', 'paste')
      await settle()

      expectDomainError(() => queue.retry(id), 'CAPTURE_NOT_RETRYABLE')
      expect(JSON.stringify(captures.find(id))).not.toContain('XYZ')
      const [block] = ctx.repos.blocks.list('all')
      const elements = ctx.repos.elements.findLiveByBlock(block.id)
      const history = elements.flatMap((e) => ctx.repos.history.findByEntity('element', e.id))
      expect(JSON.stringify([elements, history])).not.toContain('XYZ')
    })

    it('한 번에 하나씩, 들어온 순서대로 처리한다', async () => {
      const first = deferred<unknown>()
      extract.mockReturnValueOnce(first.promise).mockResolvedValueOnce(output('b'))

      const a = queue.submit('a', 'paste')
      const b = queue.submit('b', 'paste')
      await vi.advanceTimersByTimeAsync(0)

      expect(extract).toHaveBeenCalledTimes(1)
      expect(status(b.id)).toBe('pending')

      first.resolve(output('a'))
      await settle()
      expect(extract.mock.calls.map(([input]) => input.text)).toEqual(['a', 'b'])
      expect([status(a.id), status(b.id)]).toEqual(['done', 'done'])
    })

    it('할 일이 없으면 블록 없이 done', async () => {
      extract.mockResolvedValueOnce(output())

      const { id } = queue.submit('점심 뭐 먹지', 'drag')
      await settle()

      expect(status(id)).toBe('done')
      expect(blockCount()).toBe(0)
      expect(resultEvents()).toEqual([
        {
          event: 'capture:completed',
          payload: { captureId: id, blockIds: [], toCalendar: 0, needsInput: 0 }
        }
      ])
    })
  })

  describe('실패와 자동 재시도', () => {
    it('재시도할 수 없는 실패는 바로 failed이고 원문은 남긴다', async () => {
      extract.mockRejectedValueOnce(badOutputError())

      const { id } = queue.submit('a', 'paste')
      await settle(60_000)

      expect(status(id)).toBe('failed')
      expect(extract).toHaveBeenCalledTimes(1)
      expect(resultEvents()).toEqual([
        {
          event: 'capture:failed',
          payload: { captureId: id, errorCode: 'CAPTURE_EXTRACT_FAILED', canRetry: true }
        }
      ])
      expect(queue.listFailed()).toMatchObject([{ id, canRetry: true }])
    })

    it('형식이 틀린 결과도 재시도 없이 failed', async () => {
      extract.mockResolvedValueOnce({ schemaVersion: 2 })

      const { id } = queue.submit('a', 'paste')
      await settle(60_000)

      expect(status(id)).toBe('failed')
      expect(extract).toHaveBeenCalledTimes(1)
    })

    it('ExtractError가 아닌 예외는 재시도 없이 failed', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      extract.mockRejectedValueOnce(new Error('boom'))

      const { id } = queue.submit('a', 'paste')
      await settle(60_000)

      expect(status(id)).toBe('failed')
      expect(extract).toHaveBeenCalledTimes(1)
    })

    it('재시도 가능한 실패는 2초, 10초, 30초 뒤에 다시 하고, 그래도 실패하면 failed', async () => {
      extract.mockRejectedValue(networkError())

      const { id } = queue.submit('a', 'paste')
      await settle()
      expect(extract).toHaveBeenCalledTimes(1)
      expect(status(id)).toBe('pending')

      await settle(1_999)
      expect(extract).toHaveBeenCalledTimes(1)
      await settle(1)
      expect(extract).toHaveBeenCalledTimes(2)
      await settle(10_000)
      expect(extract).toHaveBeenCalledTimes(3)
      await settle(30_000)
      expect(extract).toHaveBeenCalledTimes(4)
      expect(status(id)).toBe('failed')

      await settle(60_000)
      expect(extract).toHaveBeenCalledTimes(4)
      expect(ctx.notifier.events.filter((e) => e.event === 'capture:failed')).toHaveLength(1)
    })

    it('재시도 중에 성공하면 done', async () => {
      extract.mockRejectedValueOnce(networkError()).mockResolvedValueOnce(output('a'))

      const { id } = queue.submit('a', 'paste')
      await settle()
      await settle(2_000)

      expect(status(id)).toBe('done')
      expect(blockCount()).toBe(1)
    })

    it('자동 재시도를 기다리는 동안 다음 먹이를 먼저 처리한다', async () => {
      extract
        .mockRejectedValueOnce(networkError())
        .mockResolvedValueOnce(output('b'))
        .mockResolvedValueOnce(output('a'))

      const a = queue.submit('a', 'paste')
      const b = queue.submit('b', 'paste')
      await settle()

      expect([status(a.id), status(b.id)]).toEqual(['pending', 'done'])
      await settle(2_000)
      expect(status(a.id)).toBe('done')
    })
  })

  describe('수동 다시 시도', () => {
    it('failed인 먹이를 다시 처리한다', async () => {
      extract.mockRejectedValueOnce(badOutputError()).mockResolvedValueOnce(output('a'))
      const { id } = queue.submit('a', 'paste')
      await settle()

      expect(queue.retry(id)).toMatchObject({ id, status: 'pending', canRetry: false })
      await settle()

      expect(status(id)).toBe('done')
      expect(extract).toHaveBeenCalledTimes(2)
    })

    it('자동 재시도 횟수를 처음부터 다시 센다', async () => {
      extract.mockRejectedValue(networkError())
      const { id } = queue.submit('a', 'paste')
      await settle()
      await settle(2_000)
      await settle(10_000)
      await settle(30_000)
      expect(status(id)).toBe('failed')

      queue.retry(id)
      await settle()
      expect(extract).toHaveBeenCalledTimes(5)
      expect(status(id)).toBe('pending')
      await settle(2_000)
      expect(extract).toHaveBeenCalledTimes(6)
    })

    it('원문이 없으면 CAPTURE_NOT_RETRYABLE, 없는 먹이는 CAPTURE_NOT_FOUND', () => {
      const interrupted = captures.create('paste').id
      captures.interruptUnfinished()

      expectDomainError(() => queue.retry(interrupted), 'CAPTURE_NOT_RETRYABLE')
      expectDomainError(() => queue.retry('missing'), 'CAPTURE_NOT_FOUND')
    })
  })

  describe('중복 처리 방지', () => {
    it('다시 시도를 연달아 호출하면 두 번째는 거절하고 한 번만 처리한다', async () => {
      extract.mockRejectedValueOnce(badOutputError()).mockResolvedValue(output('a'))
      const { id } = queue.submit('a', 'paste')
      await settle()

      queue.retry(id)
      expectDomainError(() => queue.retry(id), 'CAPTURE_NOT_RETRYABLE')
      await settle(60_000)

      expect(extract).toHaveBeenCalledTimes(2)
      expect(blockCount()).toBe(1)
    })

    it('자동 재시도를 기다리는 동안 들어온 수동 다시 시도는 거절한다', async () => {
      extract.mockRejectedValueOnce(networkError()).mockResolvedValue(output('a'))
      const { id } = queue.submit('a', 'paste')
      await settle()
      expect(status(id)).toBe('pending')

      expectDomainError(() => queue.retry(id), 'CAPTURE_NOT_RETRYABLE')
      await settle(60_000)

      expect(extract).toHaveBeenCalledTimes(2)
      expect(blockCount()).toBe(1)
      expect(status(id)).toBe('done')
    })

    it('처리 중인 먹이의 다시 시도는 거절한다', async () => {
      const running = deferred<unknown>()
      extract.mockReturnValueOnce(running.promise)
      const { id } = queue.submit('a', 'paste')
      await vi.advanceTimersByTimeAsync(0)
      expect(status(id)).toBe('extracting')

      expectDomainError(() => queue.retry(id), 'CAPTURE_NOT_RETRYABLE')
      running.resolve(output('a'))
      await settle(60_000)

      expect(extract).toHaveBeenCalledTimes(1)
      expect(blockCount()).toBe(1)
    })

    it('다른 경로로 상태가 바뀐 뒤 늦게 도착한 재시도 타이머는 아무것도 하지 않는다', async () => {
      extract.mockRejectedValueOnce(networkError()).mockResolvedValue(output('a'))
      const { id } = queue.submit('a', 'paste')
      await settle()
      // 자동 재시도를 기다리는 중에 상태가 바뀜 (예: 앱 시작 처리)
      captures.interruptUnfinished()

      await settle(60_000)

      expect(extract).toHaveBeenCalledTimes(1)
      expect(captures.find(id)).toMatchObject({ status: 'failed', errorCode: 'INTERRUPTED' })
      expect(blockCount()).toBe(0)
    })
  })

  describe('미완료 먹이 수 (설계 9.4)', () => {
    it('먹이를 받으면 1, 끝나면 0을 알린다. 결과 이벤트 뒤에 0이 간다', async () => {
      extract.mockResolvedValueOnce(output('a'))

      queue.submit('a', 'paste')
      expect(queue.unfinishedCount()).toBe(1)
      await settle()

      expect(queue.unfinishedCount()).toBe(0)
      expect(announcedCounts()).toEqual([1, 0])
      expect(ctx.notifier.events.map((e) => e.event).slice(-2)).toEqual([
        'capture:completed',
        'capture:unfinishedChanged'
      ])
    })

    it('여러 개를 먹이면 쌓였다가 하나씩 줄어든다', async () => {
      extract.mockResolvedValueOnce(output('a')).mockResolvedValueOnce(output('b'))

      queue.submit('a', 'paste')
      queue.submit('b', 'drag')
      await settle()

      expect(announcedCounts()).toEqual([1, 2, 1, 0])
    })

    it('자동 재시도를 기다리는 동안에도 미완료로 센다. 같은 수는 다시 알리지 않는다', async () => {
      extract.mockRejectedValueOnce(networkError()).mockResolvedValueOnce(output('a'))

      queue.submit('a', 'paste')
      await settle()
      expect(queue.unfinishedCount()).toBe(1)

      await settle(2_000)
      expect(queue.unfinishedCount()).toBe(0)
      expect(announcedCounts()).toEqual([1, 0])
    })

    it('수동 다시 시도도 미완료로 센다', async () => {
      extract.mockRejectedValueOnce(badOutputError()).mockResolvedValueOnce(output('a'))
      const { id } = queue.submit('a', 'paste')
      await settle()

      queue.retry(id)
      expect(queue.unfinishedCount()).toBe(1)
      await settle()

      expect(announcedCounts()).toEqual([1, 0, 1, 0])
    })

    it('알림이 실패해도 큐는 계속 처리한다', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const failing = new ExtractionQueue({
        captures,
        extractor: { extract },
        timezone: 'Asia/Seoul',
        notifier: {
          captureUnfinishedChanged: () => {
            throw new Error('window closed')
          }
        }
      })
      extract.mockResolvedValueOnce(output('a'))

      const { id } = failing.submit('a', 'paste')
      await failing.whenIdle()

      expect(status(id)).toBe('done')
    })
  })

  describe('실패 카드', () => {
    it('원문이 메모리에 있는 실패만 canRetry', async () => {
      extract.mockRejectedValueOnce(badOutputError())
      const withText = queue.submit('a', 'paste').id
      await settle()
      const interrupted = captures.create('drag').id
      captures.interruptUnfinished()

      expect(queue.listFailed()).toMatchObject([
        { id: withText, errorCode: 'CAPTURE_EXTRACT_FAILED', canRetry: true },
        { id: interrupted, errorCode: 'INTERRUPTED', canRetry: false }
      ])
    })

    it('닫으면 Capture와 원문을 모두 지운다', async () => {
      extract.mockRejectedValueOnce(badOutputError())
      const { id } = queue.submit('a', 'paste')
      await settle()

      queue.dismiss(id)

      expect(queue.listFailed()).toEqual([])
      expectDomainError(() => queue.retry(id), 'CAPTURE_NOT_FOUND')
    })

    it('끝나지 않은 먹이 수는 대기·처리 중·자동 재시도 대기를 센다', async () => {
      const running = deferred<unknown>()
      extract
        .mockReturnValueOnce(running.promise)
        .mockRejectedValueOnce(networkError())
        .mockResolvedValueOnce(output('b'))
      queue.submit('a', 'paste')
      queue.submit('b', 'paste')
      await vi.advanceTimersByTimeAsync(0)
      expect(queue.unfinishedCount()).toBe(2)

      running.resolve(output('a'))
      await settle()
      expect(queue.unfinishedCount()).toBe(1)

      await settle(2_000)
      expect(queue.unfinishedCount()).toBe(0)
    })
  })
})
