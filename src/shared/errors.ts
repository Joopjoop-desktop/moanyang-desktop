/**
 * 코어가 UI에 돌려주는 에러 코드. (설계 9.2)
 * 사용자에게 보여줄 문구는 UI가 이 코드를 기준으로 정한다.
 */
export const ERROR_CODES = [
  'BLOCK_NOT_FOUND',
  'ELEMENT_NOT_FOUND',
  /** 요소 종류에 맞지 않거나 형식이 틀린 값 (빈 텍스트, 잘못된 날짜·시간) */
  'ELEMENT_VALUE_INVALID',
  /** 충돌 미리보기 이후 원본·대상 블록이 바뀜. 미리보기를 다시 해야 함 (설계 7.1) */
  'CONFLICT_PREVIEW_STALE',
  /** 충돌 선택 결과에 현재 충돌 묶음 중 일부가 빠짐 (미리보기 이후 데이터가 바뀜 등) */
  'CONFLICT_SELECTION_MISSING',
  /** 충돌 선택 결과에 묶음에 없는 요소나 종류가 들어 있음 */
  'CONFLICT_SELECTION_INVALID',
  /** 충돌 묶음에서 하나도 남기지 않음 */
  'CONFLICT_SELECTION_EMPTY',
  'INTERNAL_ERROR'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]
