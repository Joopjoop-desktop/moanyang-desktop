import type { ElementType } from './model'

/**
 * 코어가 UI에 돌려주는 형태. 4단계 IPC가 그대로 사용한다.
 * DB 컬럼 중 UI에 필요 없는 값(deletedAt 등)은 넣지 않는다.
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
