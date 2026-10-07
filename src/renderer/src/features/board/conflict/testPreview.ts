import type { ConflictPreview } from '@shared/moves'
import type { ElementView } from '@shared/views'

/* 테스트 전용: 충돌 미리보기 만들기. 앱 코드에서 import하지 않는다. */

export function due(id: string, dateValue: string, blockId = 'target'): ElementView {
  return {
    id,
    blockId,
    type: 'due_date',
    value: null,
    dateValue,
    timeValue: null,
    rawText: null,
    needsConfirm: false,
    orderIndex: 0,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z'
  }
}

export function makePreview(
  existing: ElementView[],
  incoming: ElementView[],
  overrides: Partial<ConflictPreview> = {}
): ConflictPreview {
  return {
    sourceBlockId: 'source',
    targetBlockId: 'target',
    sourceUpdatedAt: '2026-10-07T01:00:00.000Z',
    targetUpdatedAt: '2026-10-07T02:00:00.000Z',
    requiresSelection: true,
    autoDiscardedIds: [],
    groups: [{ type: 'due_date', existing, incoming }],
    ...overrides
  }
}
