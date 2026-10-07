import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ExtractItem } from '../extraction/types'
import { CaptureService } from './captureService'
import {
  expectDomainError,
  historyActions,
  setupServiceTest,
  type ServiceTestContext
} from './testSupport'

function item(overrides: Partial<ExtractItem> = {}): ExtractItem {
  return { task: null, detail: null, requester: null, startDate: null, dueDate: null, ...overrides }
}

describe('CaptureService (설계 8장)', () => {
  let ctx: ServiceTestContext
  let service: CaptureService

  beforeEach(() => {
    ctx = setupServiceTest()
    service = new CaptureService(ctx.deps)
  })

  afterEach(() => {
    ctx.connection.close()
  })

  function status(captureId: string): string | undefined {
    return ctx.repos.captures.findById(captureId)?.status
  }

  /** pending으로 만들고 큐에서 꺼낸 상태(extracting)로 둔다 */
  function extracting(): string {
    const { id } = service.create('paste')
    service.startExtracting(id)
    return id
  }

  function failed(): string {
    const id = extracting()
    service.fail(id, 'CAPTURE_EXTRACT_FAILED', true)
    return id
  }

  describe('create', () => {
    it('pending으로 만들고 원문·앱 이름은 저장하지 않는다', () => {
      const row = service.create('drag')

      expect(row).toMatchObject({
        method: 'drag',
        status: 'pending',
        sourceApp: null,
        errorCode: null,
        capturedAt: '2026-10-06T00:00:00.000Z'
      })
      expect(Object.keys(row).sort()).toEqual(
        ['capturedAt', 'errorCode', 'id', 'method', 'sourceApp', 'status'].sort()
      )
    })
  })

  describe('상태 전환', () => {
    it('startExtracting은 pending일 때만 된다', () => {
      const { id } = service.create('paste')

      expect(service.startExtracting(id)).toBe(true)
      expect(status(id)).toBe('extracting')
      expect(service.startExtracting(id)).toBe(false)
    })

    it('waitForRetry는 extracting을 pending으로 돌린다', () => {
      const id = extracting()

      expect(service.waitForRetry(id)).toBe(true)
      expect(status(id)).toBe('pending')
      expect(service.waitForRetry(id)).toBe(false)
    })
  })

  describe('complete', () => {
    it('item마다 블록을 만들고 요소를 순서대로 넣는다', () => {
      const id = extracting()

      const blockIds = service.complete(id, [
        item({
          task: '견적서 송부',
          requester: '김대리',
          dueDate: { date: '2026-10-09', time: '11:00', rawText: '금요일 11시', ambiguous: true }
        }),
        item({ task: '회의실 예약' })
      ])

      expect(blockIds).toHaveLength(2)
      expect(status(id)).toBe('done')
      const first = ctx.repos.elements.findLiveByBlock(blockIds[0])
      expect(first.map((e) => e.type)).toEqual(['task', 'due_date', 'requester'])
      expect(first[1]).toMatchObject({
        dateValue: '2026-10-09',
        timeValue: '11:00',
        rawText: '금요일 11시',
        needsConfirm: true,
        captureId: id,
        orderIndex: 1
      })
      expect(ctx.repos.elements.findLiveByBlock(blockIds[1])).toMatchObject([
        { type: 'task', value: '회의실 예약', captureId: id, needsConfirm: false }
      ])
    })

    it('블록은 검토함에 들어간다', () => {
      const id = extracting()

      const [blockId] = service.complete(id, [item({ task: '견적서 송부' })])

      expect(ctx.repos.blocks.list('inbox').map((b) => b.id)).toEqual([blockId])
    })

    it('block.created와 요소마다 element.created를 남긴다', () => {
      const id = extracting()

      const [blockId] = service.complete(id, [item({ task: '견적서 송부', detail: '단가표' })])

      expect(historyActions(ctx.repos, 'block', blockId)).toEqual(['block.created'])
      for (const element of ctx.repos.elements.findLiveByBlock(blockId)) {
        const [entry] = ctx.repos.history.findByEntity('element', element.id)
        expect(entry.action).toBe('element.created')
        expect(entry.before).toBeNull()
        expect(entry.after).toMatchObject({ value: element.value, captureId: id })
      }
    })

    it('커밋 후 blocks:changed, 이어서 capture:completed를 보낸다', () => {
      const id = extracting()

      const blockIds = service.complete(id, [item({ task: 'a' }), item({ task: 'b' })])

      expect(ctx.notifier.events).toEqual([
        { event: 'blocks:changed', payload: { blockIds: [...blockIds].sort() } },
        { event: 'capture:completed', payload: { captureId: id, blockIds } }
      ])
    })

    it('items가 비어 있으면 블록 없이 done, blocks:changed 없이 빈 배열로 알린다', () => {
      const id = extracting()

      expect(service.complete(id, [])).toEqual([])
      expect(status(id)).toBe('done')
      expect(ctx.repos.blocks.list('all')).toEqual([])
      expect(ctx.notifier.events).toEqual([
        { event: 'capture:completed', payload: { captureId: id, blockIds: [] } }
      ])
    })

    it('extracting이 아니면 아무것도 만들지 않고 알리지 않는다', () => {
      const { id } = service.create('paste')

      expectDomainError(() => service.complete(id, [item({ task: 'a' })]), 'CAPTURE_NOT_FOUND')
      expect(status(id)).toBe('pending')
      expect(ctx.repos.blocks.list('all')).toEqual([])
      expect(ctx.notifier.events).toEqual([])
    })

    it('같은 먹이를 두 번 반영하려 하면 두 번째는 거절한다', () => {
      const id = extracting()
      service.complete(id, [item({ task: 'a' })])

      expectDomainError(() => service.complete(id, [item({ task: 'a' })]), 'CAPTURE_NOT_FOUND')
      expect(ctx.repos.blocks.list('all')).toHaveLength(1)
    })

    it('capture:completed 알림이 실패해도 결과를 돌려준다', () => {
      const deps = {
        ...ctx.deps,
        notifier: {
          blocksChanged: (): void => undefined,
          captureCompleted: (): void => {
            throw new Error('window closed')
          },
          captureFailed: (): void => undefined
        }
      }
      const id = extracting()

      expect(new CaptureService(deps).complete(id, [item({ task: 'a' })])).toHaveLength(1)
      expect(status(id)).toBe('done')
    })
  })

  describe('fail', () => {
    it('failed와 에러 코드를 저장하고 capture:failed를 보낸다', () => {
      const id = extracting()

      expect(service.fail(id, 'CAPTURE_EXTRACT_FAILED', true)).toBe(true)
      expect(ctx.repos.captures.findById(id)).toMatchObject({
        status: 'failed',
        errorCode: 'CAPTURE_EXTRACT_FAILED'
      })
      expect(ctx.notifier.events).toEqual([
        {
          event: 'capture:failed',
          payload: { captureId: id, errorCode: 'CAPTURE_EXTRACT_FAILED', canRetry: true }
        }
      ])
    })

    it('이미 끝난 먹이는 바꾸지 않고 알리지 않는다', () => {
      const id = extracting()
      service.complete(id, [])
      ctx.notifier.events.length = 0

      expect(service.fail(id, 'CAPTURE_EXTRACT_FAILED', false)).toBe(false)
      expect(status(id)).toBe('done')
      expect(ctx.notifier.events).toEqual([])
    })
  })

  describe('markRetrying', () => {
    it('failed를 pending으로 바꾸고 에러 코드를 비운다', () => {
      const id = failed()

      expect(service.markRetrying(id)).toMatchObject({ status: 'pending', errorCode: null })
    })

    it('연달아 호출하면 두 번째는 CAPTURE_NOT_RETRYABLE', () => {
      const id = failed()
      service.markRetrying(id)

      expectDomainError(() => service.markRetrying(id), 'CAPTURE_NOT_RETRYABLE')
    })

    it('처리 중이거나 끝난 먹이는 CAPTURE_NOT_RETRYABLE', () => {
      const working = extracting()
      const done = extracting()
      service.complete(done, [])

      expectDomainError(() => service.markRetrying(working), 'CAPTURE_NOT_RETRYABLE')
      expectDomainError(() => service.markRetrying(done), 'CAPTURE_NOT_RETRYABLE')
    })

    it('없는 먹이는 CAPTURE_NOT_FOUND', () => {
      expectDomainError(() => service.markRetrying('missing'), 'CAPTURE_NOT_FOUND')
    })
  })

  describe('interruptUnfinished', () => {
    it('pending·extracting만 INTERRUPTED로 바꾸고 알리지 않는다', () => {
      const pending = service.create('paste').id
      const working = extracting()
      const done = extracting()
      service.complete(done, [])
      const alreadyFailed = failed()
      ctx.notifier.events.length = 0

      expect(service.interruptUnfinished()).toBe(2)
      for (const id of [pending, working]) {
        expect(ctx.repos.captures.findById(id)).toMatchObject({
          status: 'failed',
          errorCode: 'INTERRUPTED'
        })
      }
      expect(status(done)).toBe('done')
      expect(ctx.repos.captures.findById(alreadyFailed)?.errorCode).toBe('CAPTURE_EXTRACT_FAILED')
      expect(ctx.notifier.events).toEqual([])
    })
  })

  describe('listFailed / dismiss', () => {
    it('실패한 먹이만 먹인 순서대로 돌려준다', () => {
      const first = failed()
      extracting()
      const second = failed()

      expect(service.listFailed().map((c) => c.id)).toEqual([first, second])
    })

    it('dismiss는 실패한 먹이를 지운다', () => {
      const id = failed()

      service.dismiss(id)

      expect(ctx.repos.captures.findById(id)).toBeUndefined()
      expect(service.listFailed()).toEqual([])
    })

    it('실패하지 않았거나 없는 먹이는 CAPTURE_NOT_FOUND이고 지우지 않는다', () => {
      const working = extracting()

      expectDomainError(() => service.dismiss(working), 'CAPTURE_NOT_FOUND')
      expectDomainError(() => service.dismiss('missing'), 'CAPTURE_NOT_FOUND')
      expect(status(working)).toBe('extracting')
    })
  })
})
