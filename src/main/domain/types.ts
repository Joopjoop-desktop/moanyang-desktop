import type { ElementType } from '@shared/model'

/**
 * 도메인 계산에 쓰는 요소. DB 행(schema)과 분리해 두어 도메인이 DB에 의존하지 않게 한다.
 * 서비스가 DB 행을 이 형태로 바꿔 넘긴다. 삭제된 요소는 넘기지 않는다.
 */
export type DomainElement = {
  id: string
  blockId: string
  type: ElementType
  /** 텍스트 요소의 값 */
  value: string | null
  /** 날짜 요소의 날짜 YYYY-MM-DD */
  dateValue: string | null
  /** 날짜 요소의 시간 HH:mm */
  timeValue: string | null
  needsConfirm: boolean
  orderIndex: number
}

/** 도메인 계산에 쓰는 라벨. 그룹 규칙에 필요한 값만 담는다. */
export type DomainLabel = {
  id: string
  /** 같은 그룹 안에서는 하나만 붙음. null이면 다른 라벨에 영향 없음 */
  groupKey: string | null
}
