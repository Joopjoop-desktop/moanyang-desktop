import type { ConflictCheckInput, ConflictPreview, ConflictResolution } from '@shared/moves'
import { unwrap } from '../../../api/client'
import type { DropIntent, MoveIntent } from './dropRules'

export type DropOutcome =
  /** 반영됨. autoDiscarded는 값이 같아 하나로 정리된 요소 수 */
  | { kind: 'done'; autoDiscarded: number }
  /** 같은 종류 요소가 겹쳐 사용자가 골라야 함 (충돌 선택 창, 설계 7.2) */
  | { kind: 'needsSelection'; intent: MoveIntent; preview: ConflictPreview }

/**
 * 놓은 동작을 코어에 요청한다. (설계 7.1)
 * 다른 블록으로 옮기거나 합칠 때는 먼저 미리보기를 받아, 고를 게 없으면 바로 반영한다.
 * 실패하면 ApiError.
 */
export async function performDrop(intent: DropIntent): Promise<DropOutcome> {
  switch (intent.kind) {
    case 'reorder':
      await unwrap(
        window.api.element.move({
          elementId: intent.elementId,
          to: { kind: 'reorder', index: intent.index }
        })
      )
      return { kind: 'done', autoDiscarded: 0 }
    case 'split':
      await unwrap(window.api.element.move({ elementId: intent.elementId, to: { kind: 'new' } }))
      return { kind: 'done', autoDiscarded: 0 }
    case 'moveElement':
    case 'merge': {
      const preview = await unwrap(window.api.element.checkConflict(conflictCheckFor(intent)))
      if (preview.requiresSelection) return { kind: 'needsSelection', intent, preview }
      await applyMove(intent)
      return { kind: 'done', autoDiscarded: preview.autoDiscardedIds.length }
    }
  }
}

/**
 * 이동·합치기를 반영한다. 충돌 선택 창에서 고른 결과가 있으면 함께 보낸다.
 * 코어가 자동 정리부터 충돌 처리까지 다시 계산해 한 번에 반영한다. (설계 7.1)
 */
export async function applyMove(
  intent: MoveIntent,
  resolution?: ConflictResolution
): Promise<void> {
  if (intent.kind === 'merge') {
    await unwrap(
      window.api.block.merge({
        sourceBlockId: intent.sourceBlockId,
        targetBlockId: intent.targetBlockId,
        resolution
      })
    )
    return
  }
  await unwrap(
    window.api.element.move({
      elementId: intent.elementId,
      to: { kind: 'block', blockId: intent.targetBlockId, index: intent.index, resolution }
    })
  )
}

/** 이동·합치기 → 충돌 미리보기 요청 */
export function conflictCheckFor(intent: MoveIntent): ConflictCheckInput {
  return intent.kind === 'merge'
    ? { kind: 'block', sourceBlockId: intent.sourceBlockId, targetBlockId: intent.targetBlockId }
    : { kind: 'element', elementId: intent.elementId, targetBlockId: intent.targetBlockId }
}
