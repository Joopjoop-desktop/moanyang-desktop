import type { BlockDeleteReason, ElementType } from './model'

/**
 * 코어가 UI에 돌려주는 형태. 4단계 IPC가 그대로 사용한다.
 * DB 컬럼 중 UI에 필요 없는 값은 넣지 않는다.
 */

export type ElementView = {
  id: string
  blockId: string
  type: ElementType
  value: string | null
  dateValue: string | null
  timeValue: string | null
  rawText: string | null
  needsConfirm: boolean
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export type LabelView = {
  id: string
  /** 시스템 라벨 식별자, 사용자 라벨은 null */
  key: string | null
  name: string
  isSystem: boolean
  groupKey: string | null
}

export type AttachedLabelView = LabelView & {
  /** "회신 대기 N일째" 계산용 */
  attachedAt: string
}

export type BlockView = {
  id: string
  reviewedAt: string | null
  completedAt: string | null
  /** 휴지통 블록에서만 값이 있다 */
  deletedAt: string | null
  deleteReason: BlockDeleteReason | null
  createdAt: string
  updatedAt: string
  /** orderIndex 순 */
  elements: ElementView[]
  labels: AttachedLabelView[]
}

/**
 * 블록에 빠진 필수 (설계 7.6). 한 블록에 여러 개일 수 있고 이 순서로 나열한다.
 * - task: 할 일 없음
 * - date: 날짜 없음 (원래 표현만 있는 날짜는 날짜로 치지 않음)
 * - dateConfirm: 날짜는 있는데 그중 하나라도 "확인 필요"
 */
export const MISSING_ESSENTIALS = ['task', 'date', 'dateConfirm'] as const
export type MissingEssential = (typeof MISSING_ESSENTIALS)[number]

/** 블록 목록 종류 (block:list) */
export const BLOCK_LIST_FILTERS = ['inbox', 'all', 'completed', 'trash'] as const
export type BlockListFilter = (typeof BLOCK_LIST_FILTERS)[number]
