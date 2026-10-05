/**
 * 코어가 UI에 돌려주는 에러 코드. (설계 9.2)
 * 사용자에게 보여줄 문구는 UI가 이 코드를 기준으로 정한다.
 */
export const ERROR_CODES = [
  /** 충돌 선택 결과에 현재 충돌 묶음 중 일부가 빠짐 (미리보기 이후 데이터가 바뀜 등) */
  'CONFLICT_SELECTION_MISSING',
  /** 충돌 선택 결과에 묶음에 없는 요소나 종류가 들어 있음 */
  'CONFLICT_SELECTION_INVALID',
  /** 충돌 묶음에서 하나도 남기지 않음 */
  'CONFLICT_SELECTION_EMPTY',
  'INTERNAL_ERROR'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]
