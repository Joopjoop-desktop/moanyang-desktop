import { describe, expect, it } from 'vitest'
import { canConfirm, carryOverSelection, defaultSelection, toggle, toResolution } from './selection'
import { due, makePreview } from './testPreview'

describe('충돌 선택 (설계 7.2, 9.6)', () => {
  const preview = makePreview([due('e1', '2026-10-09')], [due('i1', '2026-10-10', 'source')])

  it('처음에는 대상 블록에 원래 있던 요소에 체크한다', () => {
    expect(defaultSelection(preview)).toEqual({ due_date: ['e1'] })
  })

  it('체크를 켜고 끈다', () => {
    const both = toggle(defaultSelection(preview), 'due_date', 'i1')
    expect(both).toEqual({ due_date: ['e1', 'i1'] })
    expect(toggle(both, 'due_date', 'e1')).toEqual({ due_date: ['i1'] })
  })

  it('묶음마다 하나 이상 골라야 확인할 수 있다', () => {
    expect(canConfirm(preview, defaultSelection(preview))).toBe(true)
    expect(canConfirm(preview, { due_date: [] })).toBe(false)
    expect(canConfirm(preview, {})).toBe(false)
  })

  it('보낼 선택에는 묶음에 있는 요소만 담고 미리보기 당시 시각을 함께 보낸다', () => {
    expect(toResolution(preview, { due_date: ['i1', 'gone'] })).toEqual({
      selection: { due_date: ['i1'] },
      previewed: {
        sourceUpdatedAt: '2026-10-07T01:00:00.000Z',
        targetUpdatedAt: '2026-10-07T02:00:00.000Z'
      }
    })
  })

  describe('미리보기를 다시 받았을 때 이전 선택 유지', () => {
    // 사용자가 원래 것(e1)을 빼고 옮겨오는 것(i1)만 골랐다
    const chosen = { due_date: ['i1'] }

    it('ID와 값이 그대로인 요소는 이전 체크 상태를 유지한다', () => {
      const next = makePreview([due('e1', '2026-10-09')], [due('i1', '2026-10-10', 'source')])

      expect(carryOverSelection(preview, chosen, next)).toEqual({ due_date: ['i1'] })
    })

    it('값이 바뀐 요소는 기본값으로 돌아간다', () => {
      // 옮겨오는 마감일이 10/10 → 10/12로 바뀜: 체크했던 것이지만 기본값(옮겨오는 것은 해제)
      const next = makePreview([due('e1', '2026-10-09')], [due('i1', '2026-10-12', 'source')])

      expect(carryOverSelection(preview, chosen, next)).toEqual({ due_date: [] })
    })

    it('원래 표현(rawText)만 바뀐 요소는 같은 값으로 본다', () => {
      const renamed = { ...due('i1', '2026-10-10', 'source'), rawText: '금요일 말고 토요일' }
      const next = makePreview([due('e1', '2026-10-09')], [renamed])

      expect(carryOverSelection(preview, chosen, next)).toEqual({ due_date: ['i1'] })
    })

    it('새로 생긴 요소는 기본값이고, 사라진 요소는 빠진다', () => {
      // 대상 블록에 e2가 새로 생기고 e1은 사라짐
      const next = makePreview([due('e2', '2026-10-11')], [due('i1', '2026-10-10', 'source')])

      expect(carryOverSelection(preview, chosen, next)).toEqual({ due_date: ['e2', 'i1'] })
    })
  })
})
