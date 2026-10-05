import type { ElementView } from '@shared/views'
import type { ElementRow } from '../repositories/elementRepository'

/** DB 행을 UI에 돌려줄 형태로 바꾼다. */
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
