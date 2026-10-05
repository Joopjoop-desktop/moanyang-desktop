import { describe, expect, it } from 'vitest'
import { ELEMENT_TYPES } from '@shared/model'
import { ELEMENT_TYPE_RULES, isConflictType } from './elementRules'

describe('요소 종류별 규칙', () => {
  it('모든 요소 종류에 규칙이 있다', () => {
    for (const type of ELEMENT_TYPES) {
      expect(ELEMENT_TYPE_RULES[type]).toBeDefined()
    }
  })

  it('task, start_date, due_date, requester는 충돌 대상이다', () => {
    expect(isConflictType('task')).toBe(true)
    expect(isConflictType('start_date')).toBe(true)
    expect(isConflictType('due_date')).toBe(true)
    expect(isConflictType('requester')).toBe(true)
  })

  it('detail, memo는 충돌 대상이 아니다', () => {
    expect(isConflictType('detail')).toBe(false)
    expect(isConflictType('memo')).toBe(false)
  })

  it('날짜 요소만 날짜로 비교한다', () => {
    const dateTypes = ELEMENT_TYPES.filter((type) => ELEMENT_TYPE_RULES[type].valueKind === 'date')
    expect(dateTypes).toEqual(['start_date', 'due_date'])
  })
})
