import { describe, expect, it } from 'vitest'
import type { BlockView, ElementView } from '@shared/views'
import { initialChoices, planDates, type DateChoices } from './datePlan'

function date(
  id: string,
  type: 'start_date' | 'due_date',
  dateValue: string | null,
  extra: Partial<ElementView> = {}
): ElementView {
  return {
    id,
    blockId: 'b1',
    type,
    value: null,
    dateValue,
    timeValue: null,
    rawText: null,
    needsConfirm: false,
    orderIndex: 0,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    ...extra
  }
}

function block(elements: ElementView[] = []): BlockView {
  return {
    id: 'b1',
    reviewedAt: null,
    completedAt: null,
    deletedAt: null,
    deleteReason: null,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    elements,
    labels: [],
    missing: [],
    addable: []
  }
}

function choices(start: [boolean, string], due: [boolean, string]): DateChoices {
  return {
    start_date: { checked: start[0], date: start[1] },
    due_date: { checked: due[0], date: due[1] }
  }
}

describe('날짜 넣기 창 (설계 9.6)', () => {
  describe('처음 상태', () => {
    it('두 줄 모두 놓은 날짜, 마감일만 체크', () => {
      expect(initialChoices(block(), '2026-10-14')).toEqual(
        choices([false, '2026-10-14'], [true, '2026-10-14'])
      )
    })

    it('마감일이 여러 개면 체크하지 않는다', () => {
      const two = block([date('d1', 'due_date', '2026-10-09'), date('d2', 'due_date', null)])
      expect(initialChoices(two, '2026-10-14').due_date.checked).toBe(false)
    })
  })

  describe('요청 계산', () => {
    it('그 종류가 없으면 추가', () => {
      expect(planDates(block(), choices([false, ''], [true, '2026-10-14']))).toEqual({
        ok: true,
        requests: [{ kind: 'create', blockId: 'b1', type: 'due_date', dateValue: '2026-10-14' }]
      })
    })

    it('하나 있으면 날짜만 바꾸고 시간은 그대로. 원래 표현만 있는 요소도 같다', () => {
      const current = block([
        date('s1', 'start_date', null, { rawText: '다음주쯤', needsConfirm: true }),
        date('d1', 'due_date', '2026-10-09', { timeValue: '11:00', needsConfirm: true })
      ])

      expect(planDates(current, choices([true, '2026-10-12'], [true, '2026-10-14']))).toEqual({
        ok: true,
        requests: [
          { kind: 'update', elementId: 's1', dateValue: '2026-10-12', timeValue: null },
          { kind: 'update', elementId: 'd1', dateValue: '2026-10-14', timeValue: '11:00' }
        ]
      })
    })

    it('체크한 것이 없거나 날짜를 비우면 넣을 수 없다', () => {
      expect(planDates(block(), choices([false, ''], [false, '2026-10-14']))).toEqual({
        ok: false,
        reason: 'nothingChecked'
      })
      expect(planDates(block(), choices([true, ''], [true, '2026-10-14']))).toEqual({
        ok: false,
        reason: 'emptyDate'
      })
    })

    it('같은 종류가 여러 개면 어느 것을 바꿀지 몰라 넣을 수 없다', () => {
      const two = block([
        date('d1', 'due_date', '2026-10-09'),
        date('d2', 'due_date', '2026-10-10')
      ])
      expect(planDates(two, choices([false, ''], [true, '2026-10-14']))).toEqual({
        ok: false,
        reason: 'ambiguous'
      })
    })
  })

  describe('시작일 ≤ 마감일', () => {
    it('둘 다 고르면 고른 값끼리 비교한다. 같은 날은 된다', () => {
      expect(planDates(block(), choices([true, '2026-10-15'], [true, '2026-10-14']))).toEqual({
        ok: false,
        reason: 'startAfterDue'
      })
      expect(planDates(block(), choices([true, '2026-10-14'], [true, '2026-10-14'])).ok).toBe(true)
    })

    it('체크하지 않은 쪽은 블록에 있는 날짜와 비교한다', () => {
      const withStart = block([date('s1', 'start_date', '2026-10-20')])
      expect(planDates(withStart, choices([false, ''], [true, '2026-10-14']))).toEqual({
        ok: false,
        reason: 'startAfterDue'
      })
    })

    it('비교할 날짜가 없으면(원래 표현만) 막지 않는다', () => {
      const rawOnly = block([date('s1', 'start_date', null, { rawText: '다음주쯤' })])
      expect(planDates(rawOnly, choices([false, ''], [true, '2026-10-14'])).ok).toBe(true)
    })
  })
})
