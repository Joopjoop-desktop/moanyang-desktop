/**
 * 드래그로 무엇을 어디에 놓았는지 → 어떤 동작인지. (설계 7.1, 9.6)
 * dnd-kit에 의존하지 않는 순수 계산이라 테스트로 확인한다.
 */

/** 끌 수 있는 것과 놓을 수 있는 곳에 붙이는 정보 */
export type ElementDnd = {
  kind: 'element'
  elementId: string
  blockId: string
  /** 블록 안 위치 */
  index: number
  /** 블록의 요소 수 (요소가 하나뿐인 블록은 분리할 게 없다) */
  blockSize: number
}
export type DragData = ElementDnd | { kind: 'block'; blockId: string }
export type DropData = ElementDnd | { kind: 'blockArea'; blockId: string } | { kind: 'board' }

export type DropIntent =
  /** 같은 블록 안 순서 바꾸기. index는 옮긴 뒤 위치 */
  | { kind: 'reorder'; elementId: string; index: number }
  /** 다른 블록으로 이동. index는 대상 블록의 그 요소 앞, 없으면 맨 뒤 */
  | { kind: 'moveElement'; elementId: string; targetBlockId: string; index?: number }
  /** 빈 곳에 놓아 새 블록으로 분리 */
  | { kind: 'split'; elementId: string }
  /** 블록 합치기 */
  | { kind: 'merge'; sourceBlockId: string; targetBlockId: string }

/** 아무 변화가 없는 곳에 놓았으면 null */
export function resolveDrop(
  active: DragData | undefined,
  over: DropData | undefined
): DropIntent | null {
  if (!active || !over) return null
  return active.kind === 'element' ? dropElement(active, over) : dropBlock(active.blockId, over)
}

function dropElement(active: ElementDnd, over: DropData): DropIntent | null {
  const { elementId, blockId } = active
  switch (over.kind) {
    case 'element':
      if (over.blockId === blockId) {
        return over.index === active.index
          ? null
          : { kind: 'reorder', elementId, index: over.index }
      }
      return { kind: 'moveElement', elementId, targetBlockId: over.blockId, index: over.index }
    case 'blockArea':
      // 블록의 빈 부분: 다른 블록이면 맨 뒤에 붙인다. 자기 블록이면 그대로.
      return over.blockId === blockId
        ? null
        : { kind: 'moveElement', elementId, targetBlockId: over.blockId }
    case 'board':
      // 요소가 하나뿐인 블록은 분리해도 같은 모양이라 아무것도 하지 않는다
      return active.blockSize > 1 ? { kind: 'split', elementId } : null
  }
}

function dropBlock(sourceBlockId: string, over: DropData): DropIntent | null {
  if (over.kind === 'board' || over.blockId === sourceBlockId) return null
  return { kind: 'merge', sourceBlockId, targetBlockId: over.blockId }
}
