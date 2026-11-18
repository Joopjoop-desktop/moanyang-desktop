import { describe, expect, it } from 'vitest'
import type { CalendarEntryView, CalendarMarkView } from '@shared/calendar'
import { entriesOnDay, visibleWeek } from './visibleWeek'
import { layoutWeek } from './weekLayout'

// 2026-10-04(일) ~ 10-10(토)
const WEEK = [
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
  '2026-10-10'
]

function due(blockId: string, date: string): CalendarEntryView {
  const mark: CalendarMarkView = {
    kind: 'due',
    elementId: `${blockId}-due`,
    date,
    time: null,
    endTime: null,
    needsConfirm: false
  }
  return { blockId, title: blockId, completed: false, span: null, marks: [mark] }
}

function span(blockId: string, start: string, end: string): CalendarEntryView {
  return { blockId, title: blockId, completed: false, span: { start, end }, marks: [] }
}

describe('칸이 넘칠 때 "+N개" (설계 7.5 화면)', () => {
  it('하루 표시는 3개까지 보여주고 나머지는 숨긴 수로 센다', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'].map((id) => due(id, '2026-10-09'))

    const week = visibleWeek(layoutWeek(WEEK, entries))

    expect(week.marks[5].map((item) => item.entry.blockId)).toEqual(['a', 'b', 'c'])
    expect(week.hidden).toEqual([0, 0, 0, 0, 0, 2, 0])
  })

  it('막대는 3줄까지, 숨긴 막대는 그 막대가 지나는 날마다 센다', () => {
    const entries = [
      span('a', '2026-10-04', '2026-10-10'),
      span('b', '2026-10-04', '2026-10-10'),
      span('c', '2026-10-04', '2026-10-10'),
      span('hidden', '2026-10-06', '2026-10-07')
    ]

    const week = visibleWeek(layoutWeek(WEEK, entries))

    expect(week.bars.map((bar) => bar.entry.blockId)).toEqual(['a', 'b', 'c'])
    expect(week.laneCount).toBe(3)
    expect(week.hidden).toEqual([0, 0, 1, 1, 0, 0, 0])
  })

  it('넘치지 않으면 숨긴 것이 없다', () => {
    const week = visibleWeek(layoutWeek(WEEK, [due('a', '2026-10-09')]))

    expect(week.hidden).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('그날 칸에 걸린 블록: 막대가 지나가거나 표시가 있는 블록, 한 번씩만', () => {
    const passing = span('passing', '2026-10-01', '2026-10-20')
    const marked = due('marked', '2026-10-09')
    const elsewhere = due('elsewhere', '2026-10-10')
    const both: CalendarEntryView = {
      ...span('both', '2026-10-05', '2026-10-09'),
      marks: due('both', '2026-10-09').marks
    }

    expect(
      entriesOnDay([passing, marked, elsewhere, both], '2026-10-09').map((e) => e.blockId)
    ).toEqual(['passing', 'marked', 'both'])
  })
})
