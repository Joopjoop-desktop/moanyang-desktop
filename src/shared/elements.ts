import type { ElementType } from './model'

/** 요소 값 수정 (element:update). 텍스트 요소와 날짜 요소가 받는 값이 다르다. */
export type UpdateElementInput =
  /** task, detail, requester, memo */
  | { value: string }
  /** start_date, due_date. 시간이 없으면 null */
  | { dateValue: string; timeValue: string | null }

/**
 * 요소 추가 (element:create, 설계 7.7). 종류 + 값.
 * 값 모양은 수정과 같다. 종류와 값 모양이 맞지 않으면 ELEMENT_VALUE_INVALID.
 */
export type CreateElementInput = { blockId: string; type: ElementType } & UpdateElementInput
