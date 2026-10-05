import type { AttachedLabelView, BlockView, ElementView, LabelView } from '@shared/views'
import type { BlockRow } from '../repositories/blockRepository'
import type { ElementRow } from '../repositories/elementRepository'
import type { AttachedLabelRow, LabelRow } from '../repositories/labelRepository'

/* DB 행을 UI에 돌려줄 형태로 바꾼다. */

export function toElementView(row: ElementRow): ElementView {
  return {
    id: row.id,
    blockId: row.blockId,
    type: row.type,
    value: row.value,
    dateValue: row.dateValue,
    timeValue: row.timeValue,
    rawText: row.rawText,
    needsConfirm: row.needsConfirm,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export function toLabelView(row: LabelRow): LabelView {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.isSystem,
    groupKey: row.groupKey
  }
}

export function toAttachedLabelView(row: AttachedLabelRow): AttachedLabelView {
  return { ...toLabelView(row), attachedAt: row.attachedAt }
}

export function toBlockView(
  row: BlockRow,
  elements: readonly ElementRow[],
  labels: readonly AttachedLabelRow[]
): BlockView {
  return {
    id: row.id,
    reviewedAt: row.reviewedAt,
    completedAt: row.completedAt,
    deletedAt: row.deletedAt,
    deleteReason: row.deleteReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    elements: elements.map(toElementView),
    labels: labels.map(toAttachedLabelView)
  }
}
