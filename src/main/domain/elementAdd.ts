import { ELEMENT_TYPES, type ElementType } from '@shared/model'
import { ELEMENT_TYPE_RULES, isConflictType } from './elementRules'
import { DomainError } from './errors'
import type { BlockSnapshot } from './moves'
import type { DomainElement } from './types'

/**
 * 사람이 요소를 직접 추가할 때의 규칙. (설계 7.7)
 * - 충돌 대상 종류(할 일·시작일·마감일·요청자)는 블록에 그 종류가 없을 때만 추가한다.
 *   합치기로 이미 여러 개가 남은 블록은 그대로 두고 추가만 막는다.
 * - 상세·메모는 언제든 추가한다.
 */

/** 지금 이 블록에 추가할 수 있는 종류 (정해진 순서대로) */
export function addableTypes(elements: readonly DomainElement[]): ElementType[] {
  return [...ELEMENT_TYPES]
    .filter((type) => canAdd(elements, type))
    .sort((a, b) => ELEMENT_TYPE_RULES[a].rank - ELEMENT_TYPE_RULES[b].rank)
}

/**
 * 새 요소를 넣은 뒤 블록 요소의 최종 순서. 서비스가 0부터 orderIndex를 다시 매긴다.
 * 넣는 자리: 자기 종류와 그 앞 종류 요소 중 블록 안에서 가장 뒤에 있는 것 바로 뒤.
 * 그런 요소가 없으면 맨 앞. 사람이 순서를 바꿔 놓았어도 이 계산으로 정한다.
 * 이미 있는 충돌 대상 종류면 ELEMENT_KIND_EXISTS.
 */
export function planAddElement(
  block: BlockSnapshot,
  type: ElementType,
  newElementId: string
): { blockId: string; elementIds: string[] } {
  if (!canAdd(block.elements, type)) {
    throw new DomainError('ELEMENT_KIND_EXISTS', `이미 있는 종류입니다: ${type}`)
  }

  const ordered = [...block.elements].sort((a, b) => a.orderIndex - b.orderIndex)
  const rank = ELEMENT_TYPE_RULES[type].rank
  const lastBefore = ordered.findLastIndex(
    (element) => ELEMENT_TYPE_RULES[element.type].rank <= rank
  )
  const ids = ordered.map((element) => element.id)
  ids.splice(lastBefore + 1, 0, newElementId)
  return { blockId: block.blockId, elementIds: ids }
}

function canAdd(elements: readonly DomainElement[], type: ElementType): boolean {
  return !isConflictType(type) || !elements.some((element) => element.type === type)
}
