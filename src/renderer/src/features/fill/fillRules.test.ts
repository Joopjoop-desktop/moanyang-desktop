import { describe, expect, it } from 'vitest'
import type { ElementType } from '@shared/model'
import type { BlockView, ElementView } from '@shared/views'
import { blockTitle, missingChips } from './fillRules'

function element(type: ElementType, value: string | null): ElementView {
  return {
    id: `${type}-${value}`,
    blockId: 'b1',
    type,
    value,
    dateValue: null,
    timeValue: null,
    rawText: null,
    needsConfirm: false,
    orderIndex: 0,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z'
  }
}

function block(elements: ElementView[], missing: BlockView['missing'] = []): BlockView {
  return {
    id: 'b1',
    reviewedAt: null,
    completedAt: null,
    deletedAt: null,
    deleteReason: null,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    elements,
    labels: [],
    missing,
    addable: []
  }
}

describe('목록 한 줄 항목 (설계 9.6)', () => {
  it('제목은 할 일 → 요청자 → 상세 순, 없으면 (할 일 없음)', () => {
    const detail = element('detail', 'A-102 브래킷')
    const requester = element('requester', '김과장')

    expect(blockTitle(block([detail, requester, element('task', '견적서 송부')]))).toBe(
      '견적서 송부'
    )
    expect(blockTitle(block([detail, requester]))).toBe('김과장')
    expect(blockTitle(block([detail]))).toBe('A-102 브래킷')
    expect(blockTitle(block([element('memo', '메모')]))).toBe('(할 일 없음)')
  })

  it('빠진 것마다 칩 하나: 날짜 쪽은 date, 할 일 쪽은 task 색', () => {
    expect(missingChips(block([], ['task', 'date']))).toEqual([
      { label: '할 일 없음', tone: 'task' },
      { label: '날짜 없음', tone: 'date' }
    ])
    expect(missingChips(block([], ['dateConfirm']))).toEqual([{ label: '날짜 확인', tone: 'date' }])
    expect(missingChips(block([], []))).toEqual([])
  })
})
