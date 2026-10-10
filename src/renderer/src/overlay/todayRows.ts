import type { CalendarEntryView } from '@shared/calendar'

/**
 * 오늘 창의 할 일 줄 계산. (설계 9.7)
 * calendar:list(오늘~오늘)의 결과를 받아 한 블록 한 줄로 만든다. 순수 계산이라 테스트로 확인한다.
 */

/** 줄 오른쪽 표시: 오늘 마감 / 오늘 시작 / 오늘을 지나가는 기간 */
export type TodayKind = 'due' | 'start' | 'span'

export const TODAY_KIND_LABELS: Record<TodayKind, string> = {
  due: '마감',
  start: '시작',
  span: '기간'
}

export type TodayRow = {
  blockId: string
  title: string
  completed: boolean
  /** 오늘 날짜의 시작일·마감일 시간 중 가장 이른 것(HH:mm). 기간 중간 날이면 null */
  time: string | null
  kind: TodayKind
}

/**
 * 오늘 칸에 보이는 일만 줄로 만든다. 지난 마감은 넣지 않는다.
 * - 오늘 마감이 있으면 마감, 없고 오늘 시작이면 시작, 둘 다 없으면 기간
 * - 시간은 오늘 날짜의 표시(시작 점·마감 표시)에 있는 시간만 쓴다
 * - 순서: 시간 있는 일 시간 순 → 시간 없는 일 → 끝낸 일(같은 규칙으로 맨 아래).
 *   같으면 받은 순서(달력 순서) 그대로
 */
export function todayRows(entries: readonly CalendarEntryView[], today: string): TodayRow[] {
  const rows = entries.flatMap((entry) => {
    const row = toRow(entry, today)
    return row ? [row] : []
  })
  // 정렬은 받은 순서를 지키는(안정) 정렬이라, 같은 값이면 달력 순서가 남는다
  return rows.sort(byCompletedThenTime)
}

function toRow(entry: CalendarEntryView, today: string): TodayRow | null {
  const marksToday = entry.marks.filter((mark) => mark.date === today)
  const crossesToday = entry.span !== null && entry.span.start <= today && today <= entry.span.end
  if (marksToday.length === 0 && !crossesToday) return null

  const times = marksToday.flatMap((mark) => (mark.time ? [mark.time] : [])).sort()
  const kind: TodayKind = marksToday.some((mark) => mark.kind === 'due')
    ? 'due'
    : marksToday.length > 0
      ? 'start'
      : 'span'

  return {
    blockId: entry.blockId,
    title: entry.title,
    completed: entry.completed,
    time: times[0] ?? null,
    kind
  }
}

function byCompletedThenTime(a: TodayRow, b: TodayRow): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  if (a.time && b.time) return a.time.localeCompare(b.time)
  if (a.time) return -1
  if (b.time) return 1
  return 0
}
