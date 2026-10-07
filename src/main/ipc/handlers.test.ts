import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcChannel, IpcResponse, IpcResult } from '@shared/ipc'
import { CAPTURE_TEXT_MAX_LENGTH } from '@shared/captures'
import { IPC_CHANNELS } from '@shared/ipc'
import { MockExtractor } from '../extraction/mockExtractor'
import { createServices } from '../services'
import { ExtractionQueue } from '../services/extractionQueue'
import {
  seedBlock,
  seedElement,
  setupServiceTest,
  type ServiceTestContext
} from '../services/testSupport'
import { createIpcHandlers } from './handlers'
import { handleIpcRequest, type IpcHandlers } from './router'

describe('IPC 채널 핸들러', () => {
  let ctx: ServiceTestContext
  let handlers: IpcHandlers
  let queue: ExtractionQueue

  beforeEach(() => {
    ctx = setupServiceTest()
    const services = createServices(ctx.deps)
    queue = new ExtractionQueue({
      captures: services.captures,
      extractor: new MockExtractor(),
      timezone: 'Asia/Seoul'
    })
    handlers = createIpcHandlers(services, queue)
    seedBlock(ctx.repos, 'a')
    seedBlock(ctx.repos, 'b')
    seedElement(ctx.repos, 'a-task', 'a', 'task', 0, { value: '견적서' })
    seedElement(ctx.repos, 'a-memo', 'a', 'memo', 1, { value: '메모' })
    seedElement(ctx.repos, 'b-due', 'b', 'due_date', 0, { dateValue: '2026-10-09' })
  })

  afterEach(() => {
    ctx.connection.close()
  })

  function call<C extends IpcChannel>(
    channel: C,
    request: unknown
  ): Promise<IpcResult<IpcResponse<C>>> {
    return handleIpcRequest(handlers, channel, request)
  }

  async function ok<C extends IpcChannel>(channel: C, request: unknown): Promise<IpcResponse<C>> {
    const result = await call(channel, request)
    if (!result.ok) throw new Error(`${channel} 실패: ${result.error.code} ${result.error.message}`)
    return result.data
  }

  const liveIds = (blockId: string): string[] =>
    ctx.repos.elements.findLiveByBlock(blockId).map((e) => e.id)

  it('배포용 채널은 모두 핸들러가 있다', () => {
    for (const channel of IPC_CHANNELS) {
      expect(handlers[channel], channel).toBeDefined()
    }
  })

  it('block:list, block:get', async () => {
    const list = await ok('block:list', { filter: 'inbox' })
    expect(list.map((b) => b.id).sort()).toEqual(['a', 'b'])

    const block = await ok('block:get', { blockId: 'a' })
    expect(block.elements.map((e) => e.id)).toEqual(['a-task', 'a-memo'])
  })

  it('label:list는 요청 없이 부른다', async () => {
    expect(await ok('label:list', undefined)).toHaveLength(2)
  })

  describe('element:move', () => {
    it('reorder: 같은 블록 안 순서 변경', async () => {
      await ok('element:move', { elementId: 'a-memo', to: { kind: 'reorder', index: 0 } })
      expect(liveIds('a')).toEqual(['a-memo', 'a-task'])
    })

    it('block: 다른 블록으로 이동', async () => {
      const result = await ok('element:move', {
        elementId: 'a-memo',
        to: { kind: 'block', blockId: 'b' }
      })
      expect(result.changedBlockIds.sort()).toEqual(['a', 'b'])
      expect(liveIds('b')).toEqual(['b-due', 'a-memo'])
    })

    it('new: 새 블록으로 분리', async () => {
      const result = await ok('element:move', { elementId: 'a-memo', to: { kind: 'new' } })
      expect(liveIds(result.createdBlockId as string)).toEqual(['a-memo'])
    })
  })

  it('element:checkConflict는 kind로 요소 이동과 블록 합치기를 구분한다', async () => {
    const elementPreview = await ok('element:checkConflict', {
      kind: 'element',
      elementId: 'a-task',
      targetBlockId: 'b'
    })
    expect(elementPreview.requiresSelection).toBe(false)

    const blockPreview = await ok('element:checkConflict', {
      kind: 'block',
      sourceBlockId: 'a',
      targetBlockId: 'b'
    })
    expect(blockPreview).toMatchObject({ sourceBlockId: 'a', targetBlockId: 'b' })
  })

  it('element:update는 텍스트와 날짜 입력을 구분한다', async () => {
    const task = await ok('element:update', { elementId: 'a-task', value: '견적서 수정' })
    expect(task.value).toBe('견적서 수정')

    const due = await ok('element:update', {
      elementId: 'b-due',
      dateValue: '2026-10-12',
      timeValue: '10:00'
    })
    expect(due).toMatchObject({ dateValue: '2026-10-12', timeValue: '10:00' })
  })

  it('block:delete는 null을 돌려주고 블록을 휴지통으로 보낸다', async () => {
    expect(await ok('block:delete', { blockId: 'a' })).toBeNull()
    expect((await ok('block:list', { filter: 'trash' })).map((b) => b.id)).toEqual(['a'])
  })

  describe('capture:*', () => {
    it('capture:submit은 pending으로 응답하고, 추출이 끝나면 검토함에 블록이 생긴다', async () => {
      const capture = await ok('capture:submit', {
        text: '견적서 송부 2026-10-09\n\n회의실 예약',
        method: 'paste'
      })
      expect(capture).toMatchObject({ status: 'pending', method: 'paste', canRetry: false })

      await queue.whenIdle()

      const inbox = await ok('block:list', { filter: 'inbox' })
      expect(inbox).toHaveLength(4)
      expect(ctx.notifier.events.at(-1)).toMatchObject({
        event: 'capture:completed',
        payload: { captureId: capture.id }
      })
    })

    it('실패 카드: listFailed → retry → dismiss', async () => {
      const { id } = await ok('capture:submit', { text: '[실패] 견적서', method: 'drag' })
      await queue.whenIdle()

      expect(await ok('capture:listFailed', undefined)).toMatchObject([
        { id, status: 'failed', errorCode: 'CAPTURE_EXTRACT_FAILED', canRetry: true }
      ])

      expect(await ok('capture:retry', { captureId: id })).toMatchObject({ status: 'pending' })
      await queue.whenIdle()

      expect(await ok('capture:dismiss', { captureId: id })).toBeNull()
      expect(await ok('capture:listFailed', undefined)).toEqual([])
    })

    it('20,000자를 넘는 텍스트는 INVALID_INPUT이고 먹이를 만들지 않는다', async () => {
      const text = 'a'.repeat(CAPTURE_TEXT_MAX_LENGTH + 1)

      expect(await call('capture:submit', { text, method: 'paste' })).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' }
      })
      expect(queue.unfinishedCount()).toBe(0)
      expect(await ok('capture:submit', { text: text.slice(1), method: 'paste' })).toMatchObject({
        status: 'pending'
      })
      await queue.whenIdle()
    })

    it('없는 먹이는 CAPTURE_NOT_FOUND', async () => {
      expect(await call('capture:retry', { captureId: 'nope' })).toMatchObject({
        ok: false,
        error: { code: 'CAPTURE_NOT_FOUND' }
      })
    })
  })

  describe('입력 검증', () => {
    it.each([
      ['capture:submit', { text: '  \n ', method: 'paste' }],
      ['capture:submit', { text: '견적서', method: 'ocr' }],
      ['block:list', { filter: 'everything' }],
      ['block:get', { blockId: '' }],
      ['block:get', undefined],
      ['element:move', { elementId: 'a-memo', to: { kind: 'reorder', index: -1 } }],
      ['element:move', { elementId: 'a-memo', to: { kind: 'teleport' } }],
      ['element:checkConflict', { kind: 'element', elementId: 'a-task' }],
      ['block:merge', { sourceBlockId: 'a', targetBlockId: 'b', resolution: { selection: {} } }]
    ] as const)('%s %j → INVALID_INPUT', async (channel, request) => {
      expect(await call(channel, request)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' }
      })
    })
  })

  it('서비스의 DomainError는 코드 그대로 돌려준다', async () => {
    expect(await call('block:get', { blockId: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'BLOCK_NOT_FOUND' }
    })
  })
})
