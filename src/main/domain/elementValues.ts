import type { UpdateElementInput } from '@shared/elements'
import type { ElementType } from '@shared/model'
import { isValidDate, isValidTime } from './calendarValues'
import { ELEMENT_TYPE_RULES } from './elementRules'
import { DomainError } from './errors'

/** 사용자가 수정해서 바뀌는 요소 필드 */
export type ElementValuePatch =
  | { value: string }
  | { dateValue: string; timeValue: string | null; rawText: null; needsConfirm: false }

/**
 * 사용자 수정 값을 검사하고 저장할 값으로 바꾼다.
 * - 텍스트: 앞뒤 공백을 정리하고, 비어 있으면 거부
 * - 날짜: YYYY-MM-DD / HH:mm 형식 검사. 원래 표현(rawText)을 비우고 확인 필요를 끈다 (설계 6.2)
 * 요소 종류에 맞지 않는 값이면 ELEMENT_VALUE_INVALID.
 */
export function normalizeElementUpdate(
  type: ElementType,
  input: UpdateElementInput
): ElementValuePatch {
  if (ELEMENT_TYPE_RULES[type].valueKind === 'text') {
    if (!('value' in input)) invalid(`${type}에는 value가 필요합니다`)
    const value = input.value.trim()
    if (value === '') invalid('빈 값으로 바꿀 수 없습니다. 지우려면 요소를 삭제합니다')
    return { value }
  }

  if (!('dateValue' in input)) invalid(`${type}에는 dateValue가 필요합니다`)
  if (!isValidDate(input.dateValue)) invalid(`날짜 형식이 아닙니다: ${input.dateValue}`)
  if (input.timeValue !== null && !isValidTime(input.timeValue)) {
    invalid(`시간 형식이 아닙니다: ${input.timeValue}`)
  }
  return {
    dateValue: input.dateValue,
    timeValue: input.timeValue,
    rawText: null,
    needsConfirm: false
  }
}

function invalid(message: string): never {
  throw new DomainError('ELEMENT_VALUE_INVALID', message)
}
