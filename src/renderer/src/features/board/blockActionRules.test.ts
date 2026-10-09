import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BlockView } from '@shared/views'
import { ApiError } from '../../api/client'
import { actionsFor, BLOCK_ACTIONS, runBlockAction, type BlockAction } from './blockActionRules'

function block(overrides: Partial<BlockView> = {}): BlockView {
  return {
    id: 'b1',
    reviewedAt: null,
    completedAt: null,
    deletedAt: null,
    deleteReason: null,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    elements: [],
    labels: [],
    missing: ['task', 'date'],
    ...overrides
  }
}

/** window.api.block을 가짜로 바꾸고 호출을 기록한다 */
function stubBlockApi(result: unknown = { ok: true, data: null }): Array<[string, unknown]> {
  const calls: Array<[string, unknown]> = []
  function record(name: string): (request: unknown) => Promise<unknown> {
    return async (request) => {
      calls.push([name, request])
      return result
    }
  }
  vi.stubGlobal('window', {
    api: {
      block: {
        review: record('review'),
        complete: record('complete'),
        reopen: record('reopen'),
        delete: record('delete'),
        restore: record('restore')
      }
    }
  })
  return calls
}

describe('블록 상태 버튼 (설계 9.6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('할 일이 있고 날짜만 빠졌으면 이대로 두기, 완료, 삭제 (설계 7.6)', () => {
    expect(actionsFor(block({ missing: ['date'] }))).toEqual(['review', 'complete', 'delete'])
  })

  it('할 일이 없거나 날짜 확인이 필요하거나 빠진 게 없으면 이대로 두기가 없다', () => {
    for (const missing of [['task', 'date'], ['task'], ['dateConfirm'], []] as const) {
      expect(actionsFor(block({ missing: [...missing] }))).toEqual(['complete', 'delete'])
    }
  })

  it('이미 이대로 두기 했거나 완료한 블록은 완료 취소, 삭제', () => {
    const done = block({
      missing: ['date'],
      reviewedAt: '2026-10-07T01:00:00.000Z',
      completedAt: '2026-10-07T02:00:00.000Z'
    })

    expect(actionsFor(done)).toEqual(['reopen', 'delete'])
  })

  it('삭제된 블록은 복구만', () => {
    expect(
      actionsFor(block({ deletedAt: '2026-10-07T03:00:00.000Z', deleteReason: 'user' }))
    ).toEqual(['restore'])
  })

  it('이대로 두기·완료·삭제만 되돌리기가 있고, 되돌리기는 반대 동작이다', () => {
    const undos = Object.fromEntries(
      Object.entries(BLOCK_ACTIONS).map(([action, { undo }]) => [action, undo])
    )

    expect(undos).toEqual({
      review: 'unreview',
      unreview: null,
      complete: 'reopen',
      reopen: null,
      delete: 'restore',
      restore: null
    })
  })

  it('동작마다 맞는 채널을 맞는 요청으로 부른다', async () => {
    const calls = stubBlockApi()
    const actions: BlockAction[] = ['review', 'unreview', 'complete', 'reopen', 'delete', 'restore']

    for (const action of actions) await runBlockAction(action, 'b1')

    expect(calls).toEqual([
      ['review', { blockId: 'b1', reviewed: true }],
      ['review', { blockId: 'b1', reviewed: false }],
      ['complete', { blockId: 'b1' }],
      ['reopen', { blockId: 'b1' }],
      ['delete', { blockId: 'b1' }],
      ['restore', { blockId: 'b1' }]
    ])
  })

  it('코어가 실패를 돌려주면 ApiError를 던진다', async () => {
    stubBlockApi({ ok: false, error: { code: 'BLOCK_NOT_FOUND', message: '블록이 없습니다' } })

    await expect(runBlockAction('delete', 'b1')).rejects.toBeInstanceOf(ApiError)
  })
})
