import { describe, expect, it } from 'vitest'
import { overlapsRange, planBlockCalendar, type BlockCalendar } from './calendar'
import { makeElement } from './testFactories'
import type { DomainElement } from './types'

function start(id: string, dateValue: string, timeValue: string | null = null): DomainElement {
  return makeElement(id, 'start_date', { dateValue, timeValue })
}

function due(id: string, dateValue: string, timeValue: string | null = null): DomainElement {
  return makeElement(id, 'due_date', { dateValue, timeValue })
}

const task = makeElement('t', 'task', { value: '견적서 송부' })

/** 표시를 "종류:날짜"로 줄여 본다 */
function marksOf(calendar: BlockCalendar | null): string[] {
  return calendar?.marks.map((mark) => `${mark.kind}:${mark.date}`) ?? []
}

describe('블록 → 달력 표시 (설계 7.5)', () => {
  describe('기본 규칙', () => {
    it('날짜 요소가 없으면 달력에 나오지 않는다', () => {
      expect(planBlockCalendar([task])).toBeNull()
    })

    it('날짜 없이 원래 표현만 있는 요소는 달력에 나오지 않는다', () => {
      const vague = makeElement('d', 'due_date', { dateValue: null, needsConfirm: true })

      expect(planBlockCalendar([task, vague])).toBeNull()
    })

    it('마감일만: 마감 표시, 막대 없음', () => {
      const calendar = planBlockCalendar([task, due('d', '2026-10-09', '11:00')])

      expect(calendar).toEqual({
        span: null,
        marks: [
          { kind: 'due', elementId: 'd', date: '2026-10-09', time: '11:00', needsConfirm: false }
        ]
      })
    })

    it('시작일만: 점, 막대 없음', () => {
      const calendar = planBlockCalendar([start('s', '2026-10-05')])

      expect(calendar?.span).toBeNull()
      expect(marksOf(calendar)).toEqual(['start:2026-10-05'])
    })

    it('시작일 + 마감일: 기간 막대, 양 끝 표시도 남긴다', () => {
      const calendar = planBlockCalendar([due('d', '2026-10-09'), start('s', '2026-10-05')])

      expect(calendar?.span).toEqual({ start: '2026-10-05', end: '2026-10-09' })
      expect(marksOf(calendar)).toEqual(['start:2026-10-05', 'due:2026-10-09'])
    })

    it('확인 필요 여부를 표시에 담는다 (점선 테두리용)', () => {
      const unsure = makeElement('d', 'due_date', { dateValue: '2026-10-09', needsConfirm: true })

      expect(planBlockCalendar([unsure])?.marks[0].needsConfirm).toBe(true)
    })
  })

  describe('여러 날짜가 섞였을 때', () => {
    it('마감일이 여러 개면 각 날짜에 모두 표시한다', () => {
      const calendar = planBlockCalendar([due('d2', '2026-10-12'), due('d1', '2026-10-09')])

      expect(calendar?.span).toBeNull()
      expect(marksOf(calendar)).toEqual(['due:2026-10-09', 'due:2026-10-12'])
    })

    it('시작일만 여러 개면 각각 점으로 표시하고 막대는 없다', () => {
      const calendar = planBlockCalendar([start('s1', '2026-10-05'), start('s2', '2026-10-07')])

      expect(calendar?.span).toBeNull()
      expect(marksOf(calendar)).toEqual(['start:2026-10-05', 'start:2026-10-07'])
    })

    it('합친 막대는 가장 이른 시작일 ~ 가장 늦은 마감일이고, 개별 점·마감 표시는 모두 남는다', () => {
      const calendar = planBlockCalendar([
        start('s1', '2026-10-05'),
        start('s2', '2026-10-07'),
        due('d1', '2026-10-09'),
        due('d2', '2026-10-14')
      ])

      expect(calendar?.span).toEqual({ start: '2026-10-05', end: '2026-10-14' })
      expect(marksOf(calendar)).toEqual([
        'start:2026-10-05',
        'start:2026-10-07',
        'due:2026-10-09',
        'due:2026-10-14'
      ])
    })

    it('일부 시작일만 마감일보다 늦어도 막대를 그린다 (가장 이른 시작일 기준)', () => {
      const calendar = planBlockCalendar([
        start('s1', '2026-10-05'),
        start('s2', '2026-10-20'),
        due('d', '2026-10-09')
      ])

      expect(calendar?.span).toEqual({ start: '2026-10-05', end: '2026-10-09' })
      expect(marksOf(calendar)).toEqual(['start:2026-10-05', 'due:2026-10-09', 'start:2026-10-20'])
    })

    it('가장 이른 시작일이 가장 늦은 마감일보다 늦으면 막대 없이 각각 표시한다', () => {
      const calendar = planBlockCalendar([start('s', '2026-10-20'), due('d', '2026-10-09')])

      expect(calendar?.span).toBeNull()
      expect(marksOf(calendar)).toEqual(['due:2026-10-09', 'start:2026-10-20'])
    })

    it('같은 날 표시는 시간 없는 것 먼저, 그다음 시간 순', () => {
      const calendar = planBlockCalendar([
        due('d1', '2026-10-09', '15:00'),
        due('d2', '2026-10-09'),
        due('d3', '2026-10-09', '09:30')
      ])

      expect(calendar?.marks.map((mark) => mark.elementId)).toEqual(['d2', 'd3', 'd1'])
    })
  })
})

describe('조회 기간과 겹치는지 (설계 7.5 조회)', () => {
  const october = { from: '2026-10-01', to: '2026-10-31' }
  const overlaps = (calendar: BlockCalendar | null): boolean =>
    calendar !== null && overlapsRange(calendar, october.from, october.to)

  it('기간 안에 표시가 있으면 겹친다 (양 끝 포함)', () => {
    expect(overlaps(planBlockCalendar([due('d', '2026-10-01')]))).toBe(true)
    expect(overlaps(planBlockCalendar([start('s', '2026-10-31')]))).toBe(true)
  })

  it('기간 안에 날짜가 없어도 막대가 기간 전체를 가로지르면 겹친다', () => {
    const calendar = planBlockCalendar([start('s', '2026-09-20'), due('d', '2026-11-10')])

    expect(overlaps(calendar)).toBe(true)
  })

  it('막대가 기간 앞에서 시작해 기간 안에서 끝나도 겹친다', () => {
    expect(overlaps(planBlockCalendar([start('s', '2026-09-28'), due('d', '2026-10-02')]))).toBe(
      true
    )
  })

  it('기간 밖에만 있으면 겹치지 않는다', () => {
    expect(overlaps(planBlockCalendar([due('d', '2026-11-01')]))).toBe(false)
    expect(overlaps(planBlockCalendar([start('s', '2026-09-01'), due('d', '2026-09-30')]))).toBe(
      false
    )
  })

  it('뒤집혀 막대가 없으면 기간 양쪽에 걸친 표시만으로는 겹치지 않는다', () => {
    // 시작 11/10, 마감 9/20: 막대 없음, 10월 안에 표시 없음
    const calendar = planBlockCalendar([start('s', '2026-11-10'), due('d', '2026-09-20')])

    expect(overlaps(calendar)).toBe(false)
  })
})
