import { describe, expect, it } from 'vitest'
import { analyzeConflicts } from './conflicts'
import { makeElement } from './testFactories'
import type { DomainElement } from './types'

const T = 'target'
const S = 'source'

function due(
  id: string,
  blockId: string,
  dateValue: string,
  orderIndex = 0,
  needsConfirm = false
): DomainElement {
  return makeElement(id, 'due_date', { blockId, dateValue, orderIndex, needsConfirm })
}

describe('analyzeConflicts', () => {
  it('충돌 대상이 아닌 종류(detail, memo)는 그냥 추가한다', () => {
    const target = [makeElement('t-memo', 'memo', { blockId: T, value: '메모' })]
    const incoming = [
      makeElement('s-memo', 'memo', { blockId: S, value: '메모' }),
      makeElement('s-detail', 'detail', { blockId: S, value: '상세' })
    ]

    const result = analyzeConflicts(target, incoming)

    expect(result.appendIds).toEqual(['s-memo', 's-detail'])
    expect(result.autoDiscards).toEqual([])
    expect(result.conflictGroups).toEqual([])
  })

  it('대상 블록에 같은 종류가 없으면 충돌 대상이어도 그냥 추가한다', () => {
    const target = [makeElement('t-task', 'task', { blockId: T, value: '견적서' })]
    const incoming = [due('s-due', S, '2026-10-09')]

    const result = analyzeConflicts(target, incoming)

    expect(result.appendIds).toEqual(['s-due'])
    expect(result.conflictGroups).toEqual([])
  })

  it('시작일과 마감일은 서로 충돌하지 않는다', () => {
    const target = [makeElement('t-start', 'start_date', { blockId: T, dateValue: '2026-10-01' })]
    const incoming = [due('s-due', S, '2026-10-09')]

    expect(analyzeConflicts(target, incoming).appendIds).toEqual(['s-due'])
  })

  it('값이 같으면 옮겨오는 요소를 자동 정리하고 충돌 선택은 없다', () => {
    const target = [due('t-due', T, '2026-10-09')]
    const incoming = [due('s-due', S, '2026-10-09')]

    const result = analyzeConflicts(target, incoming)

    expect(result.autoDiscards).toEqual([
      { discardedId: 's-due', keptId: 't-due', confirmsKept: false }
    ])
    expect(result.appendIds).toEqual([])
    expect(result.conflictGroups).toEqual([])
  })

  it('텍스트는 앞뒤 공백만 다르면 자동 정리한다', () => {
    const target = [makeElement('t-req', 'requester', { blockId: T, value: '김과장' })]
    const incoming = [makeElement('s-req', 'requester', { blockId: S, value: ' 김과장 ' })]

    expect(analyzeConflicts(target, incoming).autoDiscards).toHaveLength(1)
  })

  it('비슷하기만 한 값은 충돌 묶음으로 보낸다', () => {
    const target = [makeElement('t-req', 'requester', { blockId: T, value: '김과장' })]
    const incoming = [makeElement('s-req', 'requester', { blockId: S, value: '김 과장' })]

    const result = analyzeConflicts(target, incoming)

    expect(result.autoDiscards).toEqual([])
    expect(result.conflictGroups).toEqual([
      { type: 'requester', existingIds: ['t-req'], incomingIds: ['s-req'] }
    ])
  })

  it('자동 정리를 먼저 하고 남은 것만 충돌 묶음으로 보낸다', () => {
    const target = [due('t-9', T, '2026-10-09')]
    const incoming = [due('s-9', S, '2026-10-09'), due('s-10', S, '2026-10-10')]

    const result = analyzeConflicts(target, incoming)

    expect(result.autoDiscards.map((d) => d.discardedId)).toEqual(['s-9'])
    expect(result.conflictGroups).toEqual([
      { type: 'due_date', existingIds: ['t-9'], incomingIds: ['s-10'] }
    ])
  })

  it('대상 블록의 같은 종류 요소는 전부 한 묶음에 들어간다 (orderIndex 순)', () => {
    const target = [due('t-10', T, '2026-10-10', 1), due('t-9', T, '2026-10-09', 0)]
    const incoming = [due('s-11', S, '2026-10-11')]

    const result = analyzeConflicts(target, incoming)

    expect(result.conflictGroups).toEqual([
      { type: 'due_date', existingIds: ['t-9', 't-10'], incomingIds: ['s-11'] }
    ])
  })

  it('대상 블록에 이미 함께 남겨둔 요소끼리는 정리하지 않는다', () => {
    // 대상 블록에 같은 값의 마감일이 둘 있어도, 옮겨오는 요소가 없으면 아무 일도 없다
    const target = [due('t-a', T, '2026-10-09', 0), due('t-b', T, '2026-10-09', 1)]
    const incoming = [makeElement('s-memo', 'memo', { blockId: S })]

    const result = analyzeConflicts(target, incoming)

    expect(result.autoDiscards).toEqual([])
    expect(result.conflictGroups).toEqual([])
  })

  it('옮겨오는 요소끼리는 비교하지 않는다', () => {
    const target = [makeElement('t-task', 'task', { blockId: T })]
    const incoming = [due('s-a', S, '2026-10-09'), due('s-b', S, '2026-10-09')]

    expect(analyzeConflicts(target, incoming).appendIds).toEqual(['s-a', 's-b'])
  })

  it('종류가 여러 개 충돌하면 종류마다 묶음을 만든다 (요소 종류 순)', () => {
    const target = [
      makeElement('t-req', 'requester', { blockId: T, value: '김과장' }),
      makeElement('t-task', 'task', { blockId: T, value: '견적서 송부' }),
      due('t-due', T, '2026-10-09')
    ]
    const incoming = [
      makeElement('s-req', 'requester', { blockId: S, value: '이대리' }),
      due('s-due', S, '2026-10-10'),
      makeElement('s-task', 'task', { blockId: S, value: '견적서 수정' })
    ]

    const types = analyzeConflicts(target, incoming).conflictGroups.map((group) => group.type)

    expect(types).toEqual(['task', 'due_date', 'requester'])
  })

  describe('날짜 자동 정리와 확인 필요(needsConfirm)', () => {
    it('남는 요소가 확인 필요이고 버려지는 요소가 확인됐으면 확인 필요를 끈다', () => {
      const target = [due('t-due', T, '2026-10-09', 0, true)]
      const incoming = [due('s-due', S, '2026-10-09', 0, false)]

      expect(analyzeConflicts(target, incoming).autoDiscards[0].confirmsKept).toBe(true)
    })

    it('둘 다 확인 필요면 그대로 둔다', () => {
      const target = [due('t-due', T, '2026-10-09', 0, true)]
      const incoming = [due('s-due', S, '2026-10-09', 0, true)]

      expect(analyzeConflicts(target, incoming).autoDiscards[0].confirmsKept).toBe(false)
    })

    it('남는 요소가 이미 확인됐으면 바꿀 것이 없다', () => {
      const target = [due('t-due', T, '2026-10-09', 0, false)]
      const incoming = [due('s-due', S, '2026-10-09', 0, true)]

      expect(analyzeConflicts(target, incoming).autoDiscards[0].confirmsKept).toBe(false)
    })
  })

  it('대상 블록의 요소가 옮겨오는 요소에 섞이면 에러를 던진다', () => {
    const element = due('same', T, '2026-10-09')

    expect(() => analyzeConflicts([element], [element])).toThrow()
  })
})
