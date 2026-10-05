import type { ElementType } from '@shared/model'
import type { ConflictSelection } from '@shared/moves'
import { analyzeConflicts, type ConflictGroup } from './conflicts'
import { DomainError } from './errors'
import type { DomainElement } from './types'

export type { ConflictSelection }

/** 블록 하나와 그 블록의 살아 있는 요소 */
export type BlockSnapshot = {
  blockId: string
  elements: readonly DomainElement[]
}

/**
 * 이동 결과로 바뀌어야 할 내용. 서비스가 한 트랜잭션에 반영하고 History를 남긴다.
 * 도메인은 DB에 쓰지 않는다. (설계 7.1 계산과 반영)
 */
export type MovePlan = {
  /** blockId가 바뀌는 요소 → element.moved */
  moves: { elementId: string; toBlockId: string }[]
  /** 같은 블록 안에서 사용자가 옮긴 요소 → element.moved (다른 요소의 재번호는 기록하지 않음) */
  reorders: { elementId: string; blockId: string }[]
  /** 버려지는 요소 (deleteReason = 'discarded') → element.discarded */
  discards: { elementId: string; cause: 'auto' | 'selection' }[]
  /** needsConfirm을 끌 요소 → element.updated */
  confirms: string[]
  /** 순서가 바뀐 블록의 최종 요소 순서. 0부터 orderIndex를 다시 매긴다. */
  orders: { blockId: string; elementIds: string[] }[]
  /** 요소가 모두 빠진 블록 → 소프트 딜리트(emptied) + 라벨 연결 전부 제거(label.detached) */
  emptiedBlocks: { blockId: string; deleteReason: 'emptied'; detachAllLabels: true }[]
  /** 분리로 새로 만들 블록 (기본 상태로 생성) */
  createdBlockId: string | null
}

function emptyPlan(): MovePlan {
  return {
    moves: [],
    reorders: [],
    discards: [],
    confirms: [],
    orders: [],
    emptiedBlocks: [],
    createdBlockId: null
  }
}

/**
 * 같은 블록 안에서 요소 하나의 순서를 바꾼다. 충돌 판단을 하지 않는다. (설계 7.1)
 * 위치가 그대로면 아무것도 바꾸지 않는다.
 * @param toIndex 옮긴 뒤 요소가 놓일 위치 (0부터, 범위를 넘으면 맨 앞/맨 뒤)
 */
export function planReorder(block: BlockSnapshot, elementId: string, toIndex: number): MovePlan {
  const ids = sortedIds(block.elements)
  const from = ids.indexOf(elementId)
  if (from === -1) throw new Error(`planReorder: 블록에 없는 요소입니다 (${elementId})`)

  ids.splice(from, 1)
  const to = clamp(toIndex, 0, ids.length)
  ids.splice(to, 0, elementId)
  if (to === from) return emptyPlan()

  return {
    ...emptyPlan(),
    reorders: [{ elementId, blockId: block.blockId }],
    orders: [{ blockId: block.blockId, elementIds: ids }]
  }
}

export type MoveToBlockInput = {
  source: BlockSnapshot
  target: BlockSnapshot
  /** 옮길 요소. 블록 합치기면 source의 요소 전부 */
  movingIds: readonly string[]
  /** 대상 블록의 현재 요소 기준으로 끼울 위치. 없으면 맨 뒤 (블록 합치기) */
  insertIndex?: number
  /** 충돌 선택 결과. 충돌 묶음이 없으면 생략 가능 */
  selection?: ConflictSelection
}

/**
 * 요소를 다른 블록으로 옮긴다. 요소 하나 이동과 블록 합치기 모두 이 함수로 계산한다. (설계 7.1, 7.2, 7.3)
 * 자동 정리부터 충돌 처리까지 전체를 다시 계산하므로, 미리보기 이후 데이터가 바뀌었으면
 * 선택 검사에서 DomainError를 던진다.
 */
export function planMoveToBlock(input: MoveToBlockInput): MovePlan {
  const { source, target, insertIndex, selection } = input
  if (source.blockId === target.blockId) {
    throw new Error('planMoveToBlock: 같은 블록 안 이동은 planReorder를 사용합니다')
  }

  const movingSet = new Set(input.movingIds)
  const sourceOrdered = sortByOrder(source.elements)
  for (const id of movingSet) {
    if (!sourceOrdered.some((element) => element.id === id)) {
      throw new Error(`planMoveToBlock: 원본 블록에 없는 요소입니다 (${id})`)
    }
  }

  const incoming = sourceOrdered.filter((element) => movingSet.has(element.id))
  const analysis = analyzeConflicts(target.elements, incoming)
  const selectionDiscards = resolveSelection(analysis.conflictGroups, selection)

  const autoDiscardIds = new Set(analysis.autoDiscards.map((d) => d.discardedId))
  const discardedIds = new Set([...autoDiscardIds, ...selectionDiscards])

  // 대상 블록으로 들어가는 요소 (원본 순서 유지)
  const arrivingIds = incoming.map((e) => e.id).filter((id) => !discardedIds.has(id))

  // 대상 블록 최종 순서: 지정 위치(없으면 맨 뒤)에 끼운 뒤 버려지는 요소를 뺀다
  const targetIds = sortedIds(target.elements)
  const at = clamp(insertIndex ?? targetIds.length, 0, targetIds.length)
  targetIds.splice(at, 0, ...arrivingIds)
  const targetOrder = targetIds.filter((id) => !discardedIds.has(id))

  const sourceRemaining = sourceOrdered.map((e) => e.id).filter((id) => !movingSet.has(id))
  const sourceEmptied = sourceRemaining.length === 0

  const orders: MovePlan['orders'] = [{ blockId: target.blockId, elementIds: targetOrder }]
  if (!sourceEmptied) orders.push({ blockId: source.blockId, elementIds: sourceRemaining })

  return {
    moves: arrivingIds.map((elementId) => ({ elementId, toBlockId: target.blockId })),
    reorders: [],
    discards: [
      ...[...autoDiscardIds].map((elementId) => ({ elementId, cause: 'auto' as const })),
      ...selectionDiscards.map((elementId) => ({ elementId, cause: 'selection' as const }))
    ],
    // 자동 정리로 남았지만 충돌 선택에서 버려진 요소는 확인할 필요가 없다
    confirms: analysis.autoDiscards
      .filter((d) => d.confirmsKept && !discardedIds.has(d.keptId))
      .map((d) => d.keptId),
    orders,
    emptiedBlocks: sourceEmptied
      ? [{ blockId: source.blockId, deleteReason: 'emptied', detachAllLabels: true }]
      : [],
    createdBlockId: null
  }
}

export type SplitInput = {
  source: BlockSnapshot
  elementId: string
  /** 새 블록 ID. 도메인이 ID를 만들지 않도록 서비스가 newId()로 만들어 넘긴다 */
  newBlockId: string
}

/**
 * 요소를 빈 곳에 놓아 그 요소만 담은 새 블록을 만든다. (설계 7.1)
 * 블록에 요소가 하나뿐이면 나눌 것이 없으므로 아무것도 바꾸지 않는다.
 */
export function planSplit(input: SplitInput): MovePlan {
  const { source, elementId, newBlockId } = input
  const ids = sortedIds(source.elements)
  if (!ids.includes(elementId)) {
    throw new Error(`planSplit: 블록에 없는 요소입니다 (${elementId})`)
  }
  if (ids.length === 1) return emptyPlan()

  return {
    ...emptyPlan(),
    moves: [{ elementId, toBlockId: newBlockId }],
    orders: [
      { blockId: source.blockId, elementIds: ids.filter((id) => id !== elementId) },
      { blockId: newBlockId, elementIds: [elementId] }
    ],
    createdBlockId: newBlockId
  }
}

/**
 * 충돌 선택을 현재 충돌 묶음과 대조하고, 고르지 않아 버려지는 요소 ID를 돌려준다. (설계 7.2)
 */
function resolveSelection(
  groups: readonly ConflictGroup[],
  selection: ConflictSelection | undefined
): string[] {
  const picked = selection ?? {}
  const groupTypes = new Set(groups.map((group) => group.type))

  for (const type of Object.keys(picked) as ElementType[]) {
    if (!groupTypes.has(type)) {
      throw new DomainError('CONFLICT_SELECTION_INVALID', `충돌 묶음에 없는 종류: ${type}`)
    }
  }

  const discarded: string[] = []
  for (const group of groups) {
    const keepIds = picked[group.type]
    if (keepIds === undefined) {
      throw new DomainError('CONFLICT_SELECTION_MISSING', `선택이 빠진 묶음: ${group.type}`)
    }
    if (keepIds.length === 0) {
      throw new DomainError('CONFLICT_SELECTION_EMPTY', `남긴 요소가 없는 묶음: ${group.type}`)
    }

    const members = [...group.existingIds, ...group.incomingIds]
    const keep = new Set(keepIds)
    for (const id of keep) {
      if (!members.includes(id)) {
        throw new DomainError('CONFLICT_SELECTION_INVALID', `묶음에 없는 요소: ${id}`)
      }
    }
    discarded.push(...members.filter((id) => !keep.has(id)))
  }
  return discarded
}

function sortByOrder(elements: readonly DomainElement[]): DomainElement[] {
  return [...elements].sort((a, b) => a.orderIndex - b.orderIndex)
}

function sortedIds(elements: readonly DomainElement[]): string[] {
  return sortByOrder(elements).map((element) => element.id)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
