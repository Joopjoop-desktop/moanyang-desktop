import type { CalendarEntryView } from '@shared/calendar'
import type { CaptureView } from '@shared/captures'
import type { BlockCalendar } from '../domain/calendar'
import type { AttachedLabelView, BlockView, ElementView, LabelView } from '@shared/views'
import type { BlockRow } from '../repositories/blockRepository'
import type { CaptureRow } from '../repositories/captureRepository'
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

/**
 * 블록 하나의 달력 표시. (설계 7.5)
 * 글자는 할 일 → 요청자 → 상세 순으로 처음 있는 값, 없으면 "(할 일 없음)".
 * elements는 살아 있는 요소, orderIndex 순.
 */
export function toCalendarEntryView(
  block: BlockRow,
  elements: readonly ElementRow[],
  calendar: BlockCalendar
): CalendarEntryView {
  return {
    blockId: block.id,
    title: calendarTitle(elements),
    completed: block.completedAt !== null,
    span: calendar.span,
    marks: calendar.marks.map((mark) => ({ ...mark }))
  }
}

const TITLE_TYPES = ['task', 'requester', 'detail'] as const

function calendarTitle(elements: readonly ElementRow[]): string {
  for (const type of TITLE_TYPES) {
    const found = elements.find((element) => element.type === type && element.value)
    if (found?.value) return found.value
  }
  return '(할 일 없음)'
}

/** canRetry는 원문이 메모리에 있는지에 달려 있어 DB 행에 없다. 추출 큐가 넘겨준다. */
export function toCaptureView(row: CaptureRow, canRetry: boolean): CaptureView {
  return {
    id: row.id,
    method: row.method,
    status: row.status,
    errorCode: row.errorCode,
    capturedAt: row.capturedAt,
    canRetry
  }
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
