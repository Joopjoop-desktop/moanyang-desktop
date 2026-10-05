import { ELEMENT_TYPES, type ElementType } from '@shared/model'
import { ELEMENT_TYPE_RULES, isConflictType } from './elementRules'
import { isSameValue } from './sameValue'
import type { DomainElement } from './types'

/** 값이 같아 자동으로 버려지는 옮겨오는 요소 (설계 7.2 자동 정리) */
export type AutoDiscard = {
  /** 버려지는 옮겨오는 요소 */
  discardedId: string
  /** 대신 남는 대상 블록의 요소 */
  keptId: string
  /** 남는 날짜 요소의 needsConfirm을 꺼야 하는지 (버려지는 쪽이 확인된 상태일 때) */
  confirmsKept: boolean
}

/** 사용자가 남길 요소를 골라야 하는 묶음. 요소 종류마다 하나. */
export type ConflictGroup = {
  type: ElementType
  /** 대상 블록에 있던 같은 종류 요소 전부 (orderIndex 순) */
  existingIds: string[]
  /** 자동 정리 후 남은 옮겨오는 요소 (옮겨오는 순서) */
  incomingIds: string[]
}

export type ConflictAnalysis = {
  /** 그대로 추가되는 옮겨오는 요소 (옮겨오는 순서) */
  appendIds: string[]
  autoDiscards: AutoDiscard[]
  /** 요소 종류 순(ELEMENT_TYPES)으로 정렬 */
  conflictGroups: ConflictGroup[]
}

/**
 * 다른 블록으로 옮겨오는 요소와 대상 블록의 요소를 비교해 분류한다. (설계 7.2 계산 순서)
 * 아무것도 바꾸지 않는 계산이므로 충돌 미리보기와 실제 이동 모두 이 함수를 쓴다.
 *
 * - 충돌 대상이 아닌 종류, 대상 블록에 같은 종류가 없는 요소 → 그냥 추가
 * - 대상 블록의 같은 종류 요소와 값이 같은 요소 → 자동 정리
 * - 나머지 → 대상 블록의 같은 종류 요소 전부와 함께 충돌 묶음
 *
 * 비교는 "옮겨오는 요소 ↔ 대상 블록 요소" 사이에서만 한다.
 * 대상 블록 요소끼리, 옮겨오는 요소끼리는 비교하지 않는다.
 *
 * @param target 대상 블록의 살아 있는 요소
 * @param incoming 다른 블록에서 옮겨오는 요소 (대상 블록 요소가 섞이면 안 됨)
 */
export function analyzeConflicts(
  target: readonly DomainElement[],
  incoming: readonly DomainElement[]
): ConflictAnalysis {
  const targetIds = new Set(target.map((element) => element.id))
  if (incoming.some((element) => targetIds.has(element.id))) {
    throw new Error('analyzeConflicts: incoming에 대상 블록의 요소가 섞여 있습니다')
  }

  const existingByType = groupByType([...target].sort((a, b) => a.orderIndex - b.orderIndex))

  const appendIds: string[] = []
  const autoDiscards: AutoDiscard[] = []
  const remainingByType = new Map<ElementType, string[]>()

  for (const element of incoming) {
    const existing = existingByType.get(element.type) ?? []

    if (!isConflictType(element.type) || existing.length === 0) {
      appendIds.push(element.id)
      continue
    }

    const match = existing.find((candidate) => isSameValue(candidate, element))
    if (match) {
      autoDiscards.push({
        discardedId: element.id,
        keptId: match.id,
        confirmsKept: shouldConfirmKept(match, element)
      })
      continue
    }

    const remaining = remainingByType.get(element.type) ?? []
    remaining.push(element.id)
    remainingByType.set(element.type, remaining)
  }

  const conflictGroups: ConflictGroup[] = []
  for (const type of ELEMENT_TYPES) {
    const remaining = remainingByType.get(type)
    if (!remaining) continue
    conflictGroups.push({
      type,
      existingIds: (existingByType.get(type) ?? []).map((element) => element.id),
      incomingIds: remaining
    })
  }

  return { appendIds, autoDiscards, conflictGroups }
}

function groupByType(elements: readonly DomainElement[]): Map<ElementType, DomainElement[]> {
  const map = new Map<ElementType, DomainElement[]>()
  for (const element of elements) {
    const list = map.get(element.type) ?? []
    list.push(element)
    map.set(element.type, list)
  }
  return map
}

/** 날짜 요소 자동 정리 시 둘 중 하나라도 확인됐으면 남는 요소의 확인 필요를 끈다. */
function shouldConfirmKept(kept: DomainElement, discarded: DomainElement): boolean {
  const isDate = ELEMENT_TYPE_RULES[kept.type].valueKind === 'date'
  return isDate && kept.needsConfirm && !discarded.needsConfirm
}
