import { describe, expect, it } from 'vitest'
import { addDays, inMonth, localToday, monthGrid, shiftMonth } from './calendarDates'

describe('월간 달력 칸 (설계 7.5 화면)', () => {
  it('일요일부터 6주, 앞뒤 달 날짜로 채운다', () => {
    // 2026-10-01은 목요일
    const grid = monthGrid({ year: 2026, month: 10 })

    expect(grid.weeks).toHaveLength(6)
    expect(grid.weeks.every((week) => week.length === 7)).toBe(true)
    expect(grid.weeks[0]).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03'
    ])
    expect(grid).toMatchObject({ from: '2026-09-27', to: '2026-11-07' })
  })

  it('1일이 일요일이면 그날부터 시작한다', () => {
    // 2026-02-01은 일요일
    expect(monthGrid({ year: 2026, month: 2 }).from).toBe('2026-02-01')
  })

  it('지난달·다음달은 해를 넘어간다', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })

  it('날짜 더하기는 달·해·윤년을 넘어간다', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('이 달 날짜인지, 이 PC 시간으로 오늘', () => {
    expect(inMonth('2026-10-09', { year: 2026, month: 10 })).toBe(true)
    expect(inMonth('2026-09-30', { year: 2026, month: 10 })).toBe(false)
    expect(localToday(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09')
  })
})
