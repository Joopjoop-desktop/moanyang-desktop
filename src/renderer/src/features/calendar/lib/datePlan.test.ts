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

/** [체크, 날짜, 시간(생략하면 빈칸)] */
type Row = [boolean, string, string?]

function choices(start: Row, due: Row): DateChoices {
  return {
    start_date: { checked: start[0], date: start[1], time: start[2] ?? '' },
    due_date: { checked: due[0], date: due[1], time: due[2] ?? '' }
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

    it('시간은 블록에 그 종류가 하나 있으면 그 시간, 없으면 빈칸', () => {
      const current = block([date('d1', 'due_date', '2026-10-09', { timeValue: '11:00' })])

      expect(initialChoices(current, '2026-10-14')).toEqual(
        choices([false, '2026-10-14'], [true, '2026-10-14', '11:00'])
      )
    })
  })

  describe('요청 계산', () => {
    it('그 종류가 없으면 추가. 고른 시간도 같이, 비우면 시간 없음', () => {
      expect(
        planDates(block(), choices([true, '2026-10-14', '10:00'], [true, '2026-10-14']))
      ).toEqual({
        ok: true,
        requests: [
          {
            kind: 'create',
            blockId: 'b1',
            type: 'start_date',
            dateValue: '2026-10-14',
            timeValue: '10:00'
          },
          {
            kind: 'create',
            blockId: 'b1',
            type: 'due_date',
            dateValue: '2026-10-14',
            timeValue: null
          }
        ]
      })
    })

    it('하나 있으면 날짜·시간을 칸에 보이는 값으로 바꾼다. 처음 상태 그대로면 시간은 유지', () => {
      const current = block([
        date('s1', 'start_date', null, { rawText: '다음주쯤', needsConfirm: true }),
        date('d1', 'due_date', '2026-10-09', { timeValue: '11:00', needsConfirm: true })
      ])
      const initial = initialChoices(current, '2026-10-14')
      const both = { ...initial, start_date: { ...initial.start_date, checked: true } }

      expect(planDates(current, both)).toEqual({
        ok: true,
        requests: [
          { kind: 'update', elementId: 's1', dateValue: '2026-10-14', timeValue: null },
          { kind: 'update', elementId: 'd1', dateValue: '2026-10-14', timeValue: '11:00' }
        ]
      })
    })

    it('시간 칸을 비우면 시간 없음으로 바꾼다', () => {
      const current = block([date('d1', 'due_date', '2026-10-09', { timeValue: '11:00' })])

      expect(planDates(current, choices([false, ''], [true, '2026-10-14', '']))).toEqual({
        ok: true,
        requests: [{ kind: 'update', elementId: 'd1', dateValue: '2026-10-14', timeValue: null }]
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

  describe('같은 날 시작 시각 ≤ 마감 시각 (설계 7.5 같은 날 한 줄)', () => {
    it('같은 날 시작 시각이 늦으면 막고, 같거나 이르면 된다', () => {
      const day = '2026-10-14'
      expect(planDates(block(), choices([true, day, '15:00'], [true, day, '09:00']))).toEqual({
        ok: false,
        reason: 'startTimeAfterDue'
      })
      expect(planDates(block(), choices([true, day, '10:00'], [true, day, '10:00'])).ok).toBe(true)
    })

    it('한쪽 시간이 없거나 다른 날이면 시각은 비교하지 않는다', () => {
      expect(
        planDates(block(), choices([true, '2026-10-14', '15:00'], [true, '2026-10-14'])).ok
      ).toBe(true)
      expect(
        planDates(block(), choices([true, '2026-10-14', '15:00'], [true, '2026-10-15', '09:00'])).ok
      ).toBe(true)
    })

    it('체크하지 않은 쪽은 블록에 있는 시간과 비교한다', () => {
      const withStart = block([date('s1', 'start_date', '2026-10-14', { timeValue: '15:00' })])
      expect(planDates(withStart, choices([false, ''], [true, '2026-10-14', '09:00']))).toEqual({
        ok: false,
        reason: 'startTimeAfterDue'
      })
    })
  })
})
