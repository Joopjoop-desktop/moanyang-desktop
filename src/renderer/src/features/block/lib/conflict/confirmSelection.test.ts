import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConflictPreview } from '@shared/moves'
import { ApiError } from '@renderer/api/client'
import { confirmSelection } from './confirmSelection'
import { due, makePreview } from '@renderer/testing/conflictPreview'

const intent = { kind: 'merge' as const, sourceBlockId: 'source', targetBlockId: 'target' }

type Reply = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } }

/**
 * window.api를 가짜로 바꾼다. block:merge는 merges 순서대로 응답하고,
 * element:checkConflict는 nextPreview를 돌려준다. 호출은 "채널 + 요청"으로 기록한다.
 */
function stubApi(merges: Reply[], nextPreview?: ConflictPreview): Array<[string, unknown]> {
  const calls: Array<[string, unknown]> = []
  vi.stubGlobal('window', {
    api: {
      block: {
        merge: async (request: unknown): Promise<Reply> => {
          calls.push(['block:merge', request])
          return merges.shift() ?? { ok: true, data: null }
        }
      },
      element: {
        checkConflict: async (request: unknown): Promise<Reply> => {
          calls.push(['element:checkConflict', request])
          return { ok: true, data: nextPreview }
        }
      }
    }
  })
  return calls
}

const stale: Reply = {
  ok: false,
  error: { code: 'CONFLICT_PREVIEW_STALE', message: 'stale' }
}

describe('충돌 선택 확인 (설계 7.1, 9.6)', () => {
  const preview = makePreview([due('e1', '2026-10-09')], [due('i1', '2026-10-10', 'source')])

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('고른 결과를 미리보기 당시 시각과 함께 보낸다', async () => {
    const calls = stubApi([])

    expect(await confirmSelection(intent, preview, { due_date: ['i1'] })).toEqual({ kind: 'done' })
    expect(calls).toEqual([
      [
        'block:merge',
        {
          sourceBlockId: 'source',
          targetBlockId: 'target',
          resolution: {
            selection: { due_date: ['i1'] },
            previewed: {
              sourceUpdatedAt: preview.sourceUpdatedAt,
              targetUpdatedAt: preview.targetUpdatedAt
            }
          }
        }
      ]
    ])
  })

  it('미리보기 이후 바뀌었으면 다시 미리보기를 받고 이전 선택을 옮긴다', async () => {
    const next = makePreview(
      [due('e1', '2026-10-09'), due('e2', '2026-10-11')],
      [due('i1', '2026-10-10', 'source')],
      { targetUpdatedAt: '2026-10-07T03:00:00.000Z' }
    )
    const calls = stubApi([stale], next)

    expect(await confirmSelection(intent, preview, { due_date: ['i1'] })).toEqual({
      kind: 'refreshed',
      preview: next,
      selection: { due_date: ['e2', 'i1'] }
    })
    expect(calls.map(([name]) => name)).toEqual(['block:merge', 'element:checkConflict'])
  })

  it('다시 받은 미리보기에 고를 게 없으면 그대로 옮긴다', async () => {
    const calls = stubApi([stale], makePreview([], [], { requiresSelection: false, groups: [] }))

    expect(await confirmSelection(intent, preview, { due_date: ['i1'] })).toEqual({ kind: 'done' })
    expect(calls.map(([name]) => name)).toEqual([
      'block:merge',
      'element:checkConflict',
      'block:merge'
    ])
    expect(calls[2][1]).toMatchObject({ resolution: undefined })
  })

  it('그 밖의 실패는 그대로 던진다', async () => {
    stubApi([{ ok: false, error: { code: 'BLOCK_NOT_FOUND', message: 'gone' } }])

    await expect(confirmSelection(intent, preview, { due_date: ['i1'] })).rejects.toBeInstanceOf(
      ApiError
    )
  })
})
