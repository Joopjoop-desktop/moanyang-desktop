import { ELEMENT_TYPE_RULES } from './elementRules'
import type { DomainElement } from './types'

type ComparableElement = Pick<DomainElement, 'type' | 'value' | 'dateValue' | 'timeValue'>

/**
 * 자동 정리 대상인 "완전히 같은 값"인지 판단한다. (설계 7.2)
 * - 종류가 다르면 같지 않다.
 * - 텍스트: 앞뒤 공백만 정리한 뒤 완전히 일치 ("김과장" ≠ "김 과장")
 * - 날짜: dateValue와 timeValue가 모두 일치 (rawText는 보지 않음)
 */
export function isSameValue(a: ComparableElement, b: ComparableElement): boolean {
  if (a.type !== b.type) return false

  if (ELEMENT_TYPE_RULES[a.type].valueKind === 'date') {
    return a.dateValue === b.dateValue && a.timeValue === b.timeValue
  }

  return normalizeText(a.value) === normalizeText(b.value)
}

function normalizeText(value: string | null): string {
  return (value ?? '').trim()
}
