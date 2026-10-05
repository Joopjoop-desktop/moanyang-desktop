import { describe, expect, it } from 'vitest'
import { isSameValue } from './sameValue'
import type { DomainElement } from './types'

type Comparable = Pick<DomainElement, 'type' | 'value' | 'dateValue' | 'timeValue'>

function text(type: 'task' | 'requester' | 'memo', value: string | null): Comparable {
  return { type, value, dateValue: null, timeValue: null }
}

function date(
  type: 'start_date' | 'due_date',
  dateValue: string | null,
  timeValue: string | null = null
): Comparable {
  return { type, value: null, dateValue, timeValue }
}

describe('isSameValue', () => {
  describe('텍스트', () => {
    it('완전히 같으면 같은 값이다', () => {
      expect(isSameValue(text('requester', '김과장'), text('requester', '김과장'))).toBe(true)
    })

    it('앞뒤 공백만 다르면 같은 값이다', () => {
      expect(isSameValue(text('requester', '  김과장 '), text('requester', '김과장'))).toBe(true)
    })

    it('가운데 공백이 다르면 다른 값이다', () => {
      expect(isSameValue(text('requester', '김과장'), text('requester', '김 과장'))).toBe(false)
    })

    it('대소문자가 다르면 다른 값이다', () => {
      expect(isSameValue(text('task', 'Report'), text('task', 'report'))).toBe(false)
    })
  })

  describe('날짜', () => {
    it('날짜와 시간이 모두 같으면 같은 값이다', () => {
      const a = date('due_date', '2026-10-09', '11:00')
      const b = date('due_date', '2026-10-09', '11:00')
      expect(isSameValue(a, b)).toBe(true)
    })

    it('시간이 둘 다 없고 날짜가 같으면 같은 값이다', () => {
      const a = date('due_date', '2026-10-09')
      const b = date('due_date', '2026-10-09')
      expect(isSameValue(a, b)).toBe(true)
    })

    it('날짜가 같아도 한쪽에만 시간이 있으면 다른 값이다', () => {
      const a = date('due_date', '2026-10-09', '11:00')
      const b = date('due_date', '2026-10-09')
      expect(isSameValue(a, b)).toBe(false)
    })

    it('날짜가 다르면 다른 값이다', () => {
      const a = date('due_date', '2026-10-09')
      const b = date('due_date', '2026-10-10')
      expect(isSameValue(a, b)).toBe(false)
    })

    it('원래 표현(rawText)은 비교하지 않는다', () => {
      const a = { ...date('due_date', '2026-10-09'), rawText: '다음주 금요일까지' }
      const b = { ...date('due_date', '2026-10-09'), rawText: '10/9' }
      expect(isSameValue(a, b)).toBe(true)
    })
  })

  it('종류가 다르면 값이 같아도 다른 값이다', () => {
    const a = date('start_date', '2026-10-09')
    const b = date('due_date', '2026-10-09')
    expect(isSameValue(a, b)).toBe(false)
  })
})
