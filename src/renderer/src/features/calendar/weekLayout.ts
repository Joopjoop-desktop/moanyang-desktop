import type { CalendarEntryView, CalendarMarkView } from '@shared/calendar'

/** 한 주 안에 그리는 막대 조각. 주를 넘어가는 막대는 주마다 나눠 그린다 */
export type BarSegment = {
  entry: CalendarEntryView
  /** 0(일) ~ 6(토) */
  startCol: number
  endCol: number
  /** 위에서부터 몇 번째 줄 (겹치는 막대끼리 줄을 나눈다) */
  lane: number
  /** 막대가 이 주 앞에서 이어져 온다 / 이 주 뒤로 이어진다 (끝을 둥글게 하지 않는다) */
  continuesBefore: boolean
  continuesAfter: boolean
}

export type DayMark = { entry: CalendarEntryView; mark: CalendarMarkView }

export type WeekLayout = {
  bars: BarSegment[]
  /** 막대 줄 수 (표시는 그 아래부터) */
  laneCount: number
  /** 날짜(일~토 순)마다 그 날의 시작 점·마감 표시 */
  marks: DayMark[][]
}

/**
 * 한 주(일~토 7개 날짜)의 막대와 표시 배치. (설계 7.5)
 * - 막대는 이 주에 걸치는 부분만 잘라 그리고, 겹치면 아래 줄로 내린다(먼저 시작·더 긴 막대가 위)
 * - 막대가 있는 블록도 개별 시작 점·마감 표시는 그날 칸에 그대로 그린다
 * - 같은 날 표시는 시간 없는 것 먼저, 그다음 시간 순(코어가 정한 순서를 블록끼리도 맞춘다)
 */
export function layoutWeek(
  week: readonly string[],
  entries: readonly CalendarEntryView[]
): WeekLayout {
  const first = week[0]
  const last = week[week.length - 1]

  const pieces = entries
    .flatMap((entry) => {
      const span = entry.span
      if (!span || span.end < first || span.start > last) return []
      const start = span.start < first ? first : span.start
      const end = span.end > last ? last : span.end
      return [
        {
          entry,
          startCol: week.indexOf(start),
          endCol: week.indexOf(end),
          continuesBefore: span.start < first,
          continuesAfter: span.end > last
        }
      ]
    })
    .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol)

  const laneEnds: number[] = []
  const bars = pieces.map((piece) => {
    let lane = laneEnds.findIndex((end) => end < piece.startCol)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = piece.endCol
    return { ...piece, lane }
  })

  const marks = week.map((date) =>
    entries
      .flatMap((entry) =>
        entry.marks.filter((mark) => mark.date === date).map((mark) => ({ entry, mark }))
      )
      .sort((a, b) => (a.mark.time ?? '').localeCompare(b.mark.time ?? ''))
  )

  return { bars, laneCount: laneEnds.length, marks }
}
