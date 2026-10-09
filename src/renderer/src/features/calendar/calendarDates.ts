/**
 * 월간 달력 날짜 계산. (설계 7.5 화면)
 * 날짜는 시간대 없는 YYYY-MM-DD라 UTC 기준으로만 계산한다(지역 시간대로 바꾸면 하루 밀릴 수 있음).
 */

export type YearMonth = { year: number; month: number }

/** 한 달 화면: 일요일 시작 6주 × 7일 */
export type MonthGrid = {
  weeks: string[][]
  /** 화면 첫날~마지막날 (calendar:list 조회 기간) */
  from: string
  to: string
}

const WEEKS = 6
const DAYS = 7

/** 달력 칸: 그 달 1일이 들어 있는 주의 일요일부터 6주. 앞뒤 달 날짜도 채운다 */
export function monthGrid({ year, month }: YearMonth): MonthGrid {
  const first = Date.UTC(year, month - 1, 1)
  const start = addDays(toDate(first), -new Date(first).getUTCDay())
  const weeks = Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: DAYS }, (_, day) => addDays(start, week * DAYS + day))
  )
  return { weeks, from: weeks[0][0], to: weeks[WEEKS - 1][DAYS - 1] }
}

/** 지난달(-1)·다음달(+1) */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return toDate(Date.UTC(year, month - 1, day + days))
}

/** "2026-10-09" → 9 */
export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10))
}

/** 그 날짜가 이 달에 속하는지 (앞뒤 달 칸은 흐리게) */
export function inMonth(date: string, { year, month }: YearMonth): boolean {
  return date.startsWith(`${year}-${String(month).padStart(2, '0')}-`)
}

/** 이 PC 시간으로 오늘 날짜. 달력의 "오늘"은 사용자가 보는 날짜다 */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function toDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}
