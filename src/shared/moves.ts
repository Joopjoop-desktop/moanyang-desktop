import type { ElementType } from './model'
import type { ElementView } from './views'

/** 충돌 묶음(요소 종류)별 "남길 요소 ID 목록" (설계 7.2) */
export type ConflictSelection = Partial<Record<ElementType, string[]>>

/** 충돌 미리보기 당시 원본·대상 블록의 updatedAt (설계 7.1 미리보기 이후 변경 감지) */
export type PreviewStamp = {
  sourceUpdatedAt: string
  targetUpdatedAt: string
}

/** 충돌 선택 결과. 선택이 있는 이동은 미리보기 당시 값도 함께 보낸다. */
export type ConflictResolution = {
  selection: ConflictSelection
  previewed: PreviewStamp
}

/** 충돌 미리보기 결과 (element:checkConflict) */
export type ConflictPreview = PreviewStamp & {
  sourceBlockId: string
  targetBlockId: string
  /** 충돌 묶음이 있어 사용자가 골라야 하는지 */
  requiresSelection: boolean
  /** 값이 같아 자동 정리될 옮겨오는 요소 */
  autoDiscardedIds: string[]
  /** 요소 종류 순 */
  groups: {
    type: ElementType
    existing: ElementView[]
    incoming: ElementView[]
  }[]
}

/** 이동 결과. UI는 바뀐 블록을 다시 불러온다. */
export type MoveResult = {
  changedBlockIds: string[]
  /** 분리로 새로 만든 블록 */
  createdBlockId: string | null
}
