import { describe, expect, it } from 'vitest'
import type { CalendarEntryView, CalendarMarkView } from '@shared/calendar'
import { layoutWeek, markTimeText, weekGridRows } from './weekLayout'

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

function mark(kind: 'start' | 'due', date: string, time: string | null = null): CalendarMarkView {
  return { kind, elementId: `${kind}-${date}`, date, time, endTime: null, needsConfirm: false }
}

function entry(
  blockId: string,
  span: CalendarEntryView['span'],
  marks: CalendarMarkView[]
): CalendarEntryView {
  return { blockId, title: blockId, completed: false, span, marks }
}

function barsOf(entries: CalendarEntryView[]): string[] {
  return layoutWeek(WEEK, entries).bars.map(
    (bar) =>
      `${bar.entry.blockId}:${bar.startCol}-${bar.endCol}@${bar.lane}` +
      `${bar.continuesBefore ? '<' : ''}${bar.continuesAfter ? '>' : ''}`
  )
}

describe('한 주 배치 (설계 7.5 화면)', () => {
  it('주 안의 막대는 그 칸만큼 그린다', () => {
    const span = entry('a', { start: '2026-10-05', end: '2026-10-08' }, [])

    expect(barsOf([span])).toEqual(['a:1-4@0'])
  })

  it('주를 넘어가는 막대는 이 주에 걸치는 부분만 그리고 이어짐을 표시한다', () => {
    const long = entry('long', { start: '2026-09-20', end: '2026-11-10' }, [])
    const tail = entry('tail', { start: '2026-10-08', end: '2026-10-14' }, [])

    expect(barsOf([long, tail])).toEqual(['long:0-6@0<>', 'tail:4-6@1>'])
  })

  it('겹치는 막대는 줄을 나누고, 안 겹치면 같은 줄을 쓴다', () => {
    const a = entry('a', { start: '2026-10-04', end: '2026-10-06' }, [])
    const b = entry('b', { start: '2026-10-05', end: '2026-10-09' }, [])
    const c = entry('c', { start: '2026-10-07', end: '2026-10-10' }, [])

    const layout = layoutWeek(WEEK, [a, b, c])

    expect(barsOf([a, b, c])).toEqual(['a:0-2@0', 'b:1-5@1', 'c:3-6@0'])
    expect(layout.laneCount).toBe(2)
  })

  it('이 주에 걸치지 않는 막대는 그리지 않는다', () => {
    expect(barsOf([entry('x', { start: '2026-10-11', end: '2026-10-20' }, [])])).toEqual([])
  })

  it('막대가 있는 블록도 개별 시작 점·마감 표시를 그날 칸에 그린다', () => {
    const merged = entry('m', { start: '2026-10-05', end: '2026-10-09' }, [
      mark('start', '2026-10-05'),
      mark('start', '2026-10-06'),
      mark('due', '2026-10-09')
    ])

    const { marks } = layoutWeek(WEEK, [merged])

    expect(marks.map((day) => day.map(({ mark: m }) => m.kind))).toEqual([
      [],
      ['start'],
      ['start'],
      [],
      [],
      ['due'],
      []
    ])
  })

  it('같은 날 표시는 블록이 달라도 시간 없는 것 먼저, 그다음 시간 순', () => {
    const a = entry('a', null, [mark('due', '2026-10-09', '15:00')])
    const b = entry('b', null, [mark('due', '2026-10-09')])
    const c = entry('c', null, [mark('due', '2026-10-09', '09:00')])

    const day = layoutWeek(WEEK, [a, b, c]).marks[5]

    expect(day.map(({ entry: e }) => e.blockId)).toEqual(['b', 'c', 'a'])
  })

  it('시간 글자: 시작·마감은 그 시간, 같은 날 표시는 시작~마감', () => {
    const same = (time: string | null, endTime: string | null): CalendarMarkView => ({
      ...mark('due', '2026-10-09'),
      kind: 'sameDay',
      time,
      endTime
    })

    expect(markTimeText(mark('due', '2026-10-09', '11:00'))).toBe('11:00')
    expect(markTimeText(mark('start', '2026-10-09'))).toBeNull()
    expect(markTimeText(same('10:00', '11:00'))).toBe('10:00~11:00')
    expect(markTimeText(same(null, '15:00'))).toBe('~15:00')
    expect(markTimeText(same('10:00', null))).toBe('10:00~')
    expect(markTimeText(same(null, null))).toBeNull()
  })

  it('줄 높이: 막대가 없는 주도 숫자 줄 + 표시 줄로 올바른 값이다', () => {
    expect(weekGridRows(0)).toBe('auto 1fr')
    expect(weekGridRows(2)).toBe('auto auto auto 1fr')
  })
})
