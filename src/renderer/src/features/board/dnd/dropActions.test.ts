import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConflictPreview } from '@shared/moves'
import { applyMove, performDrop } from './dropActions'

function preview(overrides: Partial<ConflictPreview> = {}): ConflictPreview {
  return {
    sourceBlockId: 'b1',
    targetBlockId: 'b2',
    sourceUpdatedAt: '2026-10-07T00:00:00.000Z',
    targetUpdatedAt: '2026-10-07T00:00:00.000Z',
    requiresSelection: false,
    autoDiscardedIds: [],
    groups: [],
    ...overrides
  }
}

/** window.api를 가짜로 바꾸고 "채널 이름 + 요청"을 기록한다. 미리보기는 주어진 값을 돌려준다. */
function stubApi(conflict: ConflictPreview = preview()): Array<[string, unknown]> {
  const calls: Array<[string, unknown]> = []
  function record(name: string, data: unknown = null): (request: unknown) => Promise<unknown> {
    return async (request) => {
      calls.push([name, request])
      return { ok: true, data }
    }
  }
  vi.stubGlobal('window', {
    api: {
      element: {
        move: record('element:move', { changedBlockIds: [], createdBlockId: null }),
        checkConflict: record('element:checkConflict', conflict)
      },
      block: { merge: record('block:merge', { changedBlockIds: [], createdBlockId: null }) }
    }
  })
  return calls
}

describe('놓은 동작 → 코어 호출 (설계 7.1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('순서 바꾸기와 분리는 미리보기 없이 element:move', async () => {
    const calls = stubApi()

    await performDrop({ kind: 'reorder', elementId: 'a', index: 2 })
    await performDrop({ kind: 'split', elementId: 'a' })

    expect(calls).toEqual([
      ['element:move', { elementId: 'a', to: { kind: 'reorder', index: 2 } }],
      ['element:move', { elementId: 'a', to: { kind: 'new' } }]
    ])
  })

  it('다른 블록으로 이동: 미리보기 후 고를 게 없으면 바로 옮기고, 자동 정리 수를 알려준다', async () => {
    const calls = stubApi(preview({ autoDiscardedIds: ['x'] }))

    const outcome = await performDrop({
      kind: 'moveElement',
      elementId: 'a',
      targetBlockId: 'b2',
      index: 1
    })

    expect(outcome).toEqual({ kind: 'done', autoDiscarded: 1 })
    expect(calls).toEqual([
      ['element:checkConflict', { kind: 'element', elementId: 'a', targetBlockId: 'b2' }],
      [
        'element:move',
        { elementId: 'a', to: { kind: 'block', blockId: 'b2', index: 1, resolution: undefined } }
      ]
    ])
  })

  it('합치기: 블록 미리보기 후 block:merge', async () => {
    const calls = stubApi()

    await performDrop({ kind: 'merge', sourceBlockId: 'b1', targetBlockId: 'b2' })

    expect(calls).toEqual([
      ['element:checkConflict', { kind: 'block', sourceBlockId: 'b1', targetBlockId: 'b2' }],
      ['block:merge', { sourceBlockId: 'b1', targetBlockId: 'b2', resolution: undefined }]
    ])
  })

  it('고를 게 있으면 옮기지 않고 미리보기를 돌려준다', async () => {
    const conflict = preview({ requiresSelection: true })
    const calls = stubApi(conflict)
    const intent = { kind: 'merge' as const, sourceBlockId: 'b1', targetBlockId: 'b2' }

    expect(await performDrop(intent)).toEqual({ kind: 'needsSelection', intent, preview: conflict })
    expect(calls.map(([name]) => name)).toEqual(['element:checkConflict'])
  })

  it('충돌 선택 결과를 함께 보내 반영한다', async () => {
    const calls = stubApi()
    const resolution = {
      selection: { due_date: ['x'] },
      previewed: { sourceUpdatedAt: 's', targetUpdatedAt: 't' }
    }

    await applyMove({ kind: 'moveElement', elementId: 'a', targetBlockId: 'b2' }, resolution)

    expect(calls).toEqual([
      [
        'element:move',
        { elementId: 'a', to: { kind: 'block', blockId: 'b2', index: undefined, resolution } }
      ]
    ])
  })
})
