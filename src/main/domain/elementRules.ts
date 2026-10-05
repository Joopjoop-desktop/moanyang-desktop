import type { ElementType } from '@shared/model'

type ElementTypeRule = {
  /** 이동으로 같은 종류가 겹치면 충돌 선택을 받는지 (설계 7.2) */
  conflicts: boolean
  /** 값 비교 방식: 텍스트(value) 또는 날짜(dateValue + timeValue) */
  valueKind: 'text' | 'date'
}

/**
 * 요소 종류별 규칙. 새 종류를 추가하면 여기에 규칙을 정해야 타입 검사를 통과한다.
 */
export const ELEMENT_TYPE_RULES: Record<ElementType, ElementTypeRule> = {
  task: { conflicts: true, valueKind: 'text' },
  detail: { conflicts: false, valueKind: 'text' },
  start_date: { conflicts: true, valueKind: 'date' },
  due_date: { conflicts: true, valueKind: 'date' },
  requester: { conflicts: true, valueKind: 'text' },
  memo: { conflicts: false, valueKind: 'text' }
}

export function isConflictType(type: ElementType): boolean {
  return ELEMENT_TYPE_RULES[type].conflicts
}
