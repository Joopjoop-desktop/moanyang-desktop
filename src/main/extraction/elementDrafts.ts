import type { ElementType } from '@shared/model'
import type { DateValue, ExtractItem } from './types'

/** 추출 결과로 만들 요소 하나. ID·블록·순서·시각은 서비스가 채운다. */
export type ElementDraft = {
  type: ElementType
  value: string | null
  dateValue: string | null
  timeValue: string | null
  rawText: string | null
  needsConfirm: boolean
}

/**
 * 정리된 item 하나를 블록 하나의 요소들로 바꾼다. (설계 8.6)
 * 순서: 할 일 → 상세 → 시작일 → 마감일 → 요청자. null 값은 요소를 만들지 않는다.
 * parseExtractOutput을 거친 값이어야 한다(날짜 검사, 빈 값 정리는 거기서 끝남).
 */
export function toElementDrafts(item: ExtractItem): ElementDraft[] {
  return [
    textDraft('task', item.task),
    textDraft('detail', item.detail),
    dateDraft('start_date', item.startDate),
    dateDraft('due_date', item.dueDate),
    textDraft('requester', item.requester)
  ].filter((draft): draft is ElementDraft => draft !== null)
}

function textDraft(type: ElementType, value: string | null): ElementDraft | null {
  if (value === null) return null
  return { type, value, dateValue: null, timeValue: null, rawText: null, needsConfirm: false }
}

function dateDraft(type: ElementType, date: DateValue | null): ElementDraft | null {
  if (date === null) return null
  return {
    type,
    value: null,
    dateValue: date.date,
    timeValue: date.time,
    rawText: date.rawText,
    needsConfirm: date.ambiguous
  }
}
