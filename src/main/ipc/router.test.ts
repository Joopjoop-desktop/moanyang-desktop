import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { DomainError } from '../domain/errors'
import { handleIpcRequest, type IpcHandlers } from './router'

const blockGetSchema = z.object({ blockId: z.string().min(1) })

function handlersWith(handle: (blockId: string) => unknown): IpcHandlers {
  return {
    'block:get': {
      schema: blockGetSchema,
      handle: ({ blockId }) => handle(blockId) as never
    }
  }
}

describe('handleIpcRequest (설계 9.2)', () => {
  it('성공하면 ok: true와 결과를 돌려준다', async () => {
    const handlers = handlersWith((blockId) => ({ id: blockId }))

    expect(await handleIpcRequest(handlers, 'block:get', { blockId: 'b1' })).toEqual({
      ok: true,
      data: { id: 'b1' }
    })
  })

  it('비동기 핸들러도 기다려서 돌려준다', async () => {
    const handlers = handlersWith(async (blockId) => ({ id: blockId }))

    expect(await handleIpcRequest(handlers, 'block:get', { blockId: 'b1' })).toMatchObject({
      ok: true
    })
  })

  it('요청 형식이 틀리면 INVALID_INPUT이고 핸들러를 부르지 않는다', async () => {
    let called = false
    const handlers = handlersWith(() => {
      called = true
      return null
    })

    const result = await handleIpcRequest(handlers, 'block:get', { blockId: 123 })

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(called).toBe(false)
  })

  it('DomainError는 코드와 메시지를 그대로 돌려준다', async () => {
    const handlers = handlersWith(() => {
      throw new DomainError('BLOCK_NOT_FOUND', '블록이 없습니다: b1')
    })

    expect(await handleIpcRequest(handlers, 'block:get', { blockId: 'b1' })).toEqual({
      ok: false,
      error: { code: 'BLOCK_NOT_FOUND', message: '블록이 없습니다: b1' }
    })
  })

  it('그 밖의 예외는 INTERNAL_ERROR이고 내부 메시지를 노출하지 않는다', async () => {
    const handlers = handlersWith(() => {
      throw new Error('SQLITE_CONSTRAINT: secret detail')
    })

    const result = await handleIpcRequest(handlers, 'block:get', { blockId: 'b1' })

    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } })
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('핸들러가 없는 채널은 INTERNAL_ERROR', async () => {
    expect(await handleIpcRequest({}, 'block:get', { blockId: 'b1' })).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' }
    })
  })
})
