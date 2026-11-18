import { pointerWithin, type Collision, type CollisionDetection } from '@dnd-kit/core'
import type { DropData } from './dropRules'

/** 마우스 아래에 여러 곳이 겹치면 더 작은 곳을 고른다: 요소 > 블록(카드·한 줄 항목) > 빈 곳 > 달력 칸 */
const PRIORITY: Record<DropData['kind'], number> = { element: 0, blockArea: 1, board: 2, day: 3 }

/**
 * 놓을 곳 찾기. 펼친 카드는 요소를 감싸므로 마우스 위치만으로는 둘 다 겹친다.
 * 마우스 아래에 있는 곳 중 가장 안쪽(요소)을 먼저 고른다. 아무 데도 아니면(예: 달력 머리줄) 놓지 않는다.
 */
export const pickDropTarget: CollisionDetection = (args) =>
  pointerWithin(args).sort((a, b) => priorityOf(a) - priorityOf(b))

function priorityOf(collision: Collision): number {
  const data = collision.data?.droppableContainer?.data.current as DropData | undefined
  return data ? PRIORITY[data.kind] : Number.MAX_SAFE_INTEGER
}
