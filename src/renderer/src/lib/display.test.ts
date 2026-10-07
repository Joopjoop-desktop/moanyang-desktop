import { describe, expect, it } from 'vitest'
import type { ElementView } from '@shared/views'
import { describeElement, formatCalendarDate } from './display'

function element(overrides: Partial<ElementView>): ElementView {
  return {
    id: 'e1',
    blockId: 'b1',
    type: 'task',
    value: null,
    dateValue: null,
    timeValue: null,
    rawText: null,
    needsConfirm: false,
    orderIndex: 0,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    ...overrides
  }
}

describe('formatCalendarDate (설계 9.6)', () => {
  it('올해 날짜는 월/일(요일)', () => {
    expect(formatCalendarDate('2026-10-09', null, 2026)).toBe('10/9(금)')
    expect(formatCalendarDate('2026-12-31', null, 2026)).toBe('12/31(목)')
  })

  it('시간이 있으면 뒤에 붙인다', () => {
    expect(formatCalendarDate('2026-10-09', '11:00', 2026)).toBe('10/9(금) 11:00')
  })

  it('올해가 아니면 연도를 붙인다', () => {
    expect(formatCalendarDate('2027-01-05', null, 2026)).toBe('2027/1/5(화)')
  })
})

describe('describeElement', () => {
  it('글자 요소는 값을 보여준다', () => {
    expect(describeElement(element({ type: 'requester', value: '김대리' }), 2026)).toEqual({
      primary: '김대리',
      secondary: null,
      needsConfirm: false
    })
  })

  it('날짜 요소는 날짜와 원래 표현을 함께 보여준다', () => {
    const due = element({
      type: 'due_date',
      dateValue: '2026-10-09',
      timeValue: '11:00',
      rawText: '금요일 오전 11시까지',
      needsConfirm: true
    })

    expect(describeElement(due, 2026)).toEqual({
      primary: '10/9(금) 11:00',
      secondary: '금요일 오전 11시까지',
      needsConfirm: true
    })
  })

  it('날짜 없이 원래 표현만 있으면 표현을 크게 보여준다', () => {
    const due = element({ type: 'due_date', rawText: '다음주쯤', needsConfirm: true })

    expect(describeElement(due, 2026)).toEqual({
      primary: '다음주쯤',
      secondary: null,
      needsConfirm: true
    })
  })
})
