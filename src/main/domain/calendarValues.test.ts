import { describe, expect, it } from 'vitest'
import { isValidDate, isValidTime } from './calendarValues'

describe('isValidDate', () => {
  it('달력에 있는 날짜는 true', () => {
    expect(isValidDate('2026-10-09')).toBe(true)
    expect(isValidDate('2026-12-31')).toBe(true)
    expect(isValidDate('2028-02-29')).toBe(true)
  })

  it('형식만 맞고 없는 날짜는 false', () => {
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('2026-04-31')).toBe(false)
    expect(isValidDate('2026-10-00')).toBe(false)
  })

  it('형식이 다르면 false', () => {
    expect(isValidDate('2026-1-09')).toBe(false)
    expect(isValidDate('2026/10/09')).toBe(false)
    expect(isValidDate('2026-10-09T00:00')).toBe(false)
    expect(isValidDate('')).toBe(false)
  })
})

describe('isValidTime', () => {
  it('00:00 ~ 23:59는 true', () => {
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('09:30')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
  })

  it('범위를 넘거나 형식이 다르면 false', () => {
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('12:60')).toBe(false)
    expect(isValidTime('9:00')).toBe(false)
    expect(isValidTime('09:00:00')).toBe(false)
  })
})
