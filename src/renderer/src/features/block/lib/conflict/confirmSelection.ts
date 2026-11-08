import type { ConflictPreview, ConflictSelection } from '@shared/moves'
import { ApiError, unwrap } from '@renderer/api/client'
import { applyMove, conflictCheckFor } from '@renderer/features/block/lib/dnd/dropActions'
import type { MoveIntent } from '@renderer/features/block/lib/dnd/dropRules'
import { carryOverSelection, toResolution } from './selection'

export type ConfirmOutcome =
  | { kind: 'done' }
  /** 미리보기 이후 블록이 바뀌어 새 미리보기를 받았다. 사용자가 다시 확인해야 한다 */
  | { kind: 'refreshed'; preview: ConflictPreview; selection: ConflictSelection }

/**
 * 충돌 선택 창의 "확인". (설계 7.1, 9.6)
 * - 고른 결과를 미리보기 당시 블록 시각과 함께 보낸다.
 * - CONFLICT_PREVIEW_STALE이면 미리보기를 다시 받고 이전 선택을 옮겨 돌려준다.
 *   다시 받은 미리보기에 고를 게 없으면 그대로 옮긴다.
 * - 그 밖의 실패는 ApiError로 던진다.
 */
export async function confirmSelection(
  intent: MoveIntent,
  preview: ConflictPreview,
  selection: ConflictSelection
): Promise<ConfirmOutcome> {
  try {
    await applyMove(intent, toResolution(preview, selection))
    return { kind: 'done' }
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'CONFLICT_PREVIEW_STALE') throw error
  }

  const next = await unwrap(window.api.element.checkConflict(conflictCheckFor(intent)))
  if (!next.requiresSelection) {
    await applyMove(intent)
    return { kind: 'done' }
  }
  return {
    kind: 'refreshed',
    preview: next,
    selection: carryOverSelection(preview, selection, next)
  }
}
