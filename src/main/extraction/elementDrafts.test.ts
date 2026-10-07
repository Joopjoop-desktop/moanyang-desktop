import { describe, expect, it } from 'vitest'
import { toElementDrafts } from './elementDrafts'

describe('toElementDrafts (설계 8.6)', () => {
  it('할 일 → 상세 → 시작일 → 마감일 → 요청자 순서로 만든다', () => {
    const drafts = toElementDrafts({
      task: '견적서 송부',
      detail: '단가표 첨부',
      requester: '김대리',
      startDate: { date: '2026-10-08', time: null, rawText: '내일부터', ambiguous: false },
      dueDate: { date: '2026-10-09', time: '11:00', rawText: '금요일 11시', ambiguous: false }
    })

    expect(drafts.map((d) => d.type)).toEqual([
      'task',
      'detail',
      'start_date',
      'due_date',
      'requester'
    ])
  })

  it('null 값은 요소를 만들지 않는다', () => {
    const drafts = toElementDrafts({
      task: '견적서 송부',
      detail: null,
      requester: null,
      startDate: null,
      dueDate: null
    })

    expect(drafts).toEqual([
      {
        type: 'task',
        value: '견적서 송부',
        dateValue: null,
        timeValue: null,
        rawText: null,
        needsConfirm: false
      }
    ])
  })

  it('날짜 요소는 날짜·시간·원래 표현을 담고 ambiguous를 확인 필요로 옮긴다', () => {
    const drafts = toElementDrafts({
      task: null,
      detail: null,
      requester: null,
      startDate: null,
      dueDate: { date: null, time: null, rawText: '다음주쯤', ambiguous: true }
    })

    expect(drafts).toEqual([
      {
        type: 'due_date',
        value: null,
        dateValue: null,
        timeValue: null,
        rawText: '다음주쯤',
        needsConfirm: true
      }
    ])
  })
})
