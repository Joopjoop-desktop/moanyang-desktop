import type { DomainElement } from './types'

/**
 * 블록 → 달력 표시 계산. (설계 7.5)
 * 날짜는 YYYY-MM-DD 문자열이라 문자열 비교가 곧 날짜 비교다(UTC로 바꾸지 않음, 설계 6.4).
 */

/** 날짜 하나에 찍는 표시: 시작일은 점, 마감일은 마감 표시 */
export type CalendarMark = {
  kind: 'start' | 'due'
  elementId: string
  date: string
  time: string | null
  needsConfirm: boolean
}

/** 기간 막대 (양 끝 포함) */
export type CalendarSpan = { start: string; end: string }

export type BlockCalendar = {
  /** 시작일과 마감일이 다 있고 뒤집히지 않았을 때만 */
  span: CalendarSpan | null
  /** 날짜가 있는 시작일·마감일 전부 (날짜·시간 순). 막대가 있어도 그대로 둔다 */
  marks: CalendarMark[]
}

/**
 * 블록의 요소로 달력 표시를 정한다. 달력에 나올 날짜가 없으면 null(보드에만).
 * - 마감일·시작일은 날짜마다 표시한다. 여러 개면 모두 (우선순위 없음)
 * - 시작일과 마감일이 다 있으면 가장 이른 시작일 ~ 가장 늦은 마감일을 막대로 그린다
 * - 가장 이른 시작일이 가장 늦은 마감일보다 늦으면(뒤집힘) 막대 없이 표시만 남긴다
 * - 날짜 없이 원래 표현만 있는 요소(예: "다음주쯤")는 빠진다
 * 삭제된 요소는 넘기지 않는다(서비스 몫).
 */
export function planBlockCalendar(elements: readonly DomainElement[]): BlockCalendar | null {
  const marks = elements.flatMap(toMark).sort(byDateThenTime)
  if (marks.length === 0) return null

  const starts = marks.filter((mark) => mark.kind === 'start').map((mark) => mark.date)
  const dues = marks.filter((mark) => mark.kind === 'due').map((mark) => mark.date)
  if (starts.length === 0 || dues.length === 0) return { span: null, marks }

  const start = starts.reduce((a, b) => (a < b ? a : b))
  const end = dues.reduce((a, b) => (a > b ? a : b))
  return { span: start <= end ? { start, end } : null, marks }
}

/**
 * 조회 기간(from~to, 양 끝 포함)과 겹치는지. (설계 7.5 조회)
 * 기간 안에 표시가 하나도 없어도 막대가 기간을 가로지르면 겹친다.
 */
export function overlapsRange(calendar: BlockCalendar, from: string, to: string): boolean {
  if (calendar.span && calendar.span.start <= to && calendar.span.end >= from) return true
  return calendar.marks.some((mark) => mark.date >= from && mark.date <= to)
}

function toMark(element: DomainElement): CalendarMark[] {
  if (element.type !== 'start_date' && element.type !== 'due_date') return []
  if (element.dateValue === null) return []
  return [
    {
      kind: element.type === 'start_date' ? 'start' : 'due',
      elementId: element.id,
      date: element.dateValue,
      time: element.timeValue,
      needsConfirm: element.needsConfirm
    }
  ]
}

/** 날짜 → 시간(없는 것 먼저) → 요소 ID 순. 같은 입력이면 항상 같은 순서 */
function byDateThenTime(a: CalendarMark, b: CalendarMark): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? '').localeCompare(b.time ?? '') ||
    a.elementId.localeCompare(b.elementId)
  )
}
