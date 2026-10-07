import type { UpdateElementInput } from '@shared/elements'
import type { ElementType } from '@shared/model'
import type { ElementView } from '@shared/views'

/** 날짜 요소인지 (날짜칸 + 시간칸으로 고친다) */
export function isDateType(type: ElementType): boolean {
  return type === 'start_date' || type === 'due_date'
}

/** 편집 중인 값. 입력칸은 빈 문자열로 비어 있음을 나타낸다. */
export type ElementDraft =
  { kind: 'text'; value: string } | { kind: 'date'; dateValue: string; timeValue: string }

export function draftFrom(element: ElementView): ElementDraft {
  if (isDateType(element.type)) {
    return { kind: 'date', dateValue: element.dateValue ?? '', timeValue: element.timeValue ?? '' }
  }
  return { kind: 'text', value: element.value ?? '' }
}

export type EditResult =
  | { kind: 'save'; input: UpdateElementInput }
  /** 고친 게 없음. 코어를 부르지 않고 편집만 닫는다 */
  | { kind: 'unchanged' }
  | { kind: 'invalid'; message: string }

/**
 * 편집한 값을 element:update 요청으로 바꾼다. (설계 9.6)
 * - 글자: 앞뒤 공백을 지운다. 비우면 저장하지 않는다(지우려면 삭제)
 * - 날짜: 날짜는 꼭 있어야 하고, 시간은 비우면 null
 * 날짜 요소는 같은 날짜로 저장해도 코어가 원래 표현을 비우고 확인 필요를 끄므로(설계 6.2) 항상 보낸다.
 * 형식 상세 검사(없는 날짜 등)는 코어가 한다.
 */
export function toUpdate(element: ElementView, draft: ElementDraft): EditResult {
  if (draft.kind === 'text') {
    const value = draft.value.trim()
    if (value === '')
      return { kind: 'invalid', message: '비워둘 수 없어요. 지우려면 삭제해 주세요.' }
    if (value === element.value) return { kind: 'unchanged' }
    return { kind: 'save', input: { value } }
  }
  if (draft.dateValue === '') return { kind: 'invalid', message: '날짜를 골라 주세요.' }
  return {
    kind: 'save',
    input: {
      dateValue: draft.dateValue,
      timeValue: draft.timeValue === '' ? null : draft.timeValue
    }
  }
}

/** 새 메모 값. 비어 있으면 null */
export function memoValue(text: string): string | null {
  const value = text.trim()
  return value === '' ? null : value
}
