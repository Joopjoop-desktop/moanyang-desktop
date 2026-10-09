/**
 * 코어가 UI에 돌려주는 에러 코드. (설계 9.2)
 * 사용자에게 보여줄 문구는 UI가 이 코드를 기준으로 정한다.
 */
export const ERROR_CODES = [
  'BLOCK_NOT_FOUND',
  'ELEMENT_NOT_FOUND',
  'LABEL_NOT_FOUND',
  /** 요소 종류에 맞지 않거나 형식이 틀린 값 (빈 텍스트, 잘못된 날짜·시간) */
  'ELEMENT_VALUE_INVALID',
  /** 이미 있는 종류(할 일·시작일·마감일·요청자)를 또 추가하려 함. 있으면 수정한다 (설계 7.7) */
  'ELEMENT_KIND_EXISTS',
  /** 충돌 미리보기 이후 원본·대상 블록이 바뀜. 미리보기를 다시 해야 함 (설계 7.1) */
  'CONFLICT_PREVIEW_STALE',
  /** 충돌 선택 결과에 현재 충돌 묶음 중 일부가 빠짐 (미리보기 이후 데이터가 바뀜 등) */
  'CONFLICT_SELECTION_MISSING',
  /** 충돌 선택 결과에 묶음에 없는 요소나 종류가 들어 있음 */
  'CONFLICT_SELECTION_INVALID',
  /** 충돌 묶음에서 하나도 남기지 않음 */
  'CONFLICT_SELECTION_EMPTY',
  'CAPTURE_NOT_FOUND',
  /** 실패 상태가 아니거나(처리 중·자동 재시도 대기 등) 원문이 메모리에 없음 (설계 8.7) */
  'CAPTURE_NOT_RETRYABLE',
  /** 추출 실패: 재시도 불가 실패이거나 자동 재시도를 모두 실패함. Capture.errorCode에도 저장 */
  'CAPTURE_EXTRACT_FAILED',
  /** 처리 중에 앱이 종료됨. 앱 시작 시 기록. 원문이 없어 다시 시도할 수 없음 (설계 8.2) */
  'INTERRUPTED',
  /** 요청 형식이 계약과 다름 (IPC 입력 검증 실패) */
  'INVALID_INPUT',
  'INTERNAL_ERROR'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]
