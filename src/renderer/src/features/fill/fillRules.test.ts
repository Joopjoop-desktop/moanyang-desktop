import { describe, expect, it } from 'vitest'
import type { ElementType } from '@shared/model'
import type { BlockView, ElementView } from '@shared/views'
import { blockTitle, missingLabel } from './fillRules'

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
    missing
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

  it('빠진 것은 첫 번째 하나만 짧게', () => {
    expect(missingLabel(block([], ['task', 'date']))).toBe('할 일 없음')
    expect(missingLabel(block([], ['date']))).toBe('날짜 없음')
    expect(missingLabel(block([], ['dateConfirm']))).toBe('날짜 확인')
    expect(missingLabel(block([], []))).toBeNull()
  })
})
