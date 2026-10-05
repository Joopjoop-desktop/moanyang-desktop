import type { BlockSnapshot } from './moves'

/**
 * 사용자가 요소를 삭제했을 때 바뀌어야 할 내용. (설계 7.3)
 *
 * - element: 요소에 deletedAt, deleteReason = 'user' → History `element.deleted`
 * - block: 마지막 요소라서 요소는 그대로 두고 블록을 user로 삭제 → History `block.deleted` 하나만
 *   (after: { deleteReason: 'user', trigger: 'element.delete', elementId })
 *   라벨 연결은 복구를 위해 유지한다.
 */
export type DeleteElementPlan =
  | {
      kind: 'element'
      elementId: string
      deleteReason: 'user'
      /** 남은 요소의 최종 순서. 0부터 orderIndex를 다시 매긴다. */
      order: { blockId: string; elementIds: string[] }
    }
  | {
      kind: 'block'
      blockId: string
      deleteReason: 'user'
      keepLabels: true
      trigger: { action: 'element.delete'; elementId: string }
    }

export function planDeleteElement(block: BlockSnapshot, elementId: string): DeleteElementPlan {
  const ordered = [...block.elements].sort((a, b) => a.orderIndex - b.orderIndex)
  if (!ordered.some((element) => element.id === elementId)) {
    throw new Error(`planDeleteElement: 블록에 없는 요소입니다 (${elementId})`)
  }

  const remaining = ordered.filter((element) => element.id !== elementId).map((e) => e.id)

  if (remaining.length === 0) {
    return {
      kind: 'block',
      blockId: block.blockId,
      deleteReason: 'user',
      keepLabels: true,
      trigger: { action: 'element.delete', elementId }
    }
  }

  return {
    kind: 'element',
    elementId,
    deleteReason: 'user',
    order: { blockId: block.blockId, elementIds: remaining }
  }
}
