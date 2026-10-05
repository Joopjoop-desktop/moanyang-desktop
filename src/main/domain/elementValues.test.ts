import { describe, expect, it } from 'vitest'
import { DomainError } from './errors'
import { normalizeElementUpdate } from './elementValues'

function expectInvalid(fn: () => unknown): void {
  expect(fn).toThrow(DomainError)
  try {
    fn()
  } catch (error) {
    expect((error as DomainError).code).toBe('ELEMENT_VALUE_INVALID')
  }
}

describe('normalizeElementUpdate', () => {
  it('텍스트는 앞뒤 공백을 정리한다', () => {
    expect(normalizeElementUpdate('task', { value: '  견적서 송부 ' })).toEqual({
      value: '견적서 송부'
    })
  })

  it('빈 텍스트는 거부한다', () => {
    expectInvalid(() => normalizeElementUpdate('memo', { value: '   ' }))
  })

  it('날짜를 고치면 원래 표현을 비우고 확인 필요를 끈다', () => {
    expect(
      normalizeElementUpdate('due_date', { dateValue: '2026-10-12', timeValue: '14:30' })
    ).toEqual({
      dateValue: '2026-10-12',
      timeValue: '14:30',
      rawText: null,
      needsConfirm: false
    })
  })

  it('없는 날짜나 잘못된 시간은 거부한다', () => {
    expectInvalid(() =>
      normalizeElementUpdate('due_date', { dateValue: '2026-02-30', timeValue: null })
    )
    expectInvalid(() =>
      normalizeElementUpdate('due_date', { dateValue: '2026/10/12', timeValue: null })
    )
    expectInvalid(() =>
      normalizeElementUpdate('start_date', { dateValue: '2026-10-12', timeValue: '24:00' })
    )
  })

  it('요소 종류에 맞지 않는 값은 거부한다', () => {
    expectInvalid(() =>
      normalizeElementUpdate('task', { dateValue: '2026-10-12', timeValue: null })
    )
    expectInvalid(() => normalizeElementUpdate('due_date', { value: '다음주 금요일' }))
  })
})
