import type { CalendarEntryView } from '@shared/calendar'
import type { BarSegment, DayMark, WeekLayout } from './weekLayout'

/** 하루 칸에 보여주는 표시 수, 한 주에 보여주는 막대 줄 수 (설계 7.5 화면) */
export const MAX_MARKS_PER_DAY = 3
export const MAX_BAR_LANES = 3

export type VisibleWeek = {
  bars: BarSegment[]
  laneCount: number
  marks: DayMark[][]
  /** 날짜(일~토 순)마다 숨긴 항목 수: 넘친 표시 + 그날을 지나는 숨긴 막대 */
  hidden: number[]
}

/**
 * 칸이 넘치지 않게 자른다. 숨긴 것은 그날의 "+N개"로 센다.
 * - 막대는 위에서 MAX_BAR_LANES줄까지
 * - 표시는 하루 MAX_MARKS_PER_DAY개까지 (시간 순 앞에서부터)
 */
export function visibleWeek(layout: WeekLayout): VisibleWeek {
  const bars = layout.bars.filter((bar) => bar.lane < MAX_BAR_LANES)
  const hiddenBars = layout.bars.filter((bar) => bar.lane >= MAX_BAR_LANES)

  const hidden = layout.marks.map((day, col) => {
    const overflowMarks = Math.max(0, day.length - MAX_MARKS_PER_DAY)
    const overflowBars = hiddenBars.filter((bar) => bar.startCol <= col && col <= bar.endCol)
    return overflowMarks + overflowBars.length
  })

  return {
    bars,
    laneCount: Math.min(layout.laneCount, MAX_BAR_LANES),
    marks: layout.marks.map((day) => day.slice(0, MAX_MARKS_PER_DAY)),
    hidden
  }
}

/**
 * 그날 칸에 걸린 블록 전부("+N개"를 눌렀을 때 목록). 막대가 지나가거나 표시가 있는 블록.
 * 같은 블록은 한 번만, 받은 순서(코어가 날짜 순으로 줌)대로.
 */
export function entriesOnDay(
  entries: readonly CalendarEntryView[],
  date: string
): CalendarEntryView[] {
  return entries.filter(
    (entry) =>
      (entry.span !== null && entry.span.start <= date && date <= entry.span.end) ||
      entry.marks.some((mark) => mark.date === date)
  )
}
