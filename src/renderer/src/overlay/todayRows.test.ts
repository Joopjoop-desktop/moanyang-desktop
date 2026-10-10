import { describe, expect, it } from 'vitest'
import type { CalendarEntryView, CalendarMarkView } from '@shared/calendar'
import { todayRows } from './todayRows'

const TODAY = '2026-10-10'

function mark(kind: 'start' | 'due', date: string, time: string | null = null): CalendarMarkView {
  return { kind, elementId: `${kind}-${date}-${time}`, date, time, needsConfirm: false }
}

function entry(
  blockId: string,
  marks: CalendarMarkView[],
  options: { span?: CalendarEntryView['span']; completed?: boolean } = {}
): CalendarEntryView {
  return {
    blockId,
    title: blockId,
    completed: options.completed ?? false,
    span: options.span ?? null,
    marks
  }
}

/** "블록:종류:시간" 으로 줄여 본다 */
function summary(entries: CalendarEntryView[]): string[] {
  return todayRows(entries, TODAY).map((row) => `${row.blockId}:${row.kind}:${row.time ?? '-'}`)
}

describe('오늘 할 일 줄 (설계 9.7)', () => {
  it('오늘 마감·오늘 시작·오늘을 지나가는 기간을 한 줄씩', () => {
    const due = entry('due', [mark('due', TODAY, '11:00')])
    const start = entry('start', [mark('start', TODAY)])
    const span = entry('span', [mark('start', '2026-09-20'), mark('due', '2026-11-05')], {
      span: { start: '2026-09-20', end: '2026-11-05' }
    })

    expect(summary([due, start, span])).toEqual(['due:due:11:00', 'start:start:-', 'span:span:-'])
  })

  it('지난 마감처럼 오늘 칸에 없는 일은 넣지 않는다', () => {
    expect(summary([entry('past', [mark('due', '2026-10-08')])])).toEqual([])
  })

  it('기간 중간 날에는 시작·마감 시간이 있어도 시간 없이 보여준다', () => {
    const span = entry(
      'report',
      [mark('start', '2026-09-20', '09:00'), mark('due', '2026-11-05', '18:00')],
      { span: { start: '2026-09-20', end: '2026-11-05' } }
    )

    expect(summary([span])).toEqual(['report:span:-'])
  })

  it('오늘 시작이면서 마감이면 한 줄, 마감으로 표시하고 오늘 시간 중 가장 이른 것', () => {
    const both = entry('both', [mark('start', TODAY, '09:00'), mark('due', TODAY, '18:00')], {
      span: { start: TODAY, end: TODAY }
    })

    expect(summary([both])).toEqual(['both:due:09:00'])
  })

  it('기간의 마지막 날이 오늘이면 마감, 오늘 마감의 시간만 쓴다', () => {
    const ending = entry('ending', [mark('start', '2026-10-01', '08:00'), mark('due', TODAY)], {
      span: { start: '2026-10-01', end: TODAY }
    })

    expect(summary([ending])).toEqual(['ending:due:-'])
  })

  it('시간 있는 일 시간 순 → 시간 없는 일 → 끝낸 일, 같으면 받은 순서', () => {
    const entries = [
      entry('noTimeA', [mark('due', TODAY)]),
      entry('late', [mark('due', TODAY, '15:00')]),
      entry('doneEarly', [mark('due', TODAY, '08:00')], { completed: true }),
      entry('early', [mark('start', TODAY, '09:30')]),
      entry('noTimeB', [mark('start', TODAY)]),
      entry('doneNoTime', [mark('due', TODAY)], { completed: true })
    ]

    expect(todayRows(entries, TODAY).map((row) => row.blockId)).toEqual([
      'early',
      'late',
      'noTimeA',
      'noTimeB',
      'doneEarly',
      'doneNoTime'
    ])
  })
})
