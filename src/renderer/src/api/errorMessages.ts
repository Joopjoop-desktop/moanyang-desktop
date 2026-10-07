import type { ErrorCode } from '@shared/errors'
import { ApiError } from './client'

/** 알 수 없는 오류에 보여줄 문구 */
export const GENERIC_ERROR_MESSAGE = '문제가 생겼어요. 다시 시도해 주세요.'

/**
 * 에러 코드 → 사용자에게 보여줄 문구. (설계 9.2, 9.5)
 * Record 타입이라 코드를 새로 추가하면 여기서 문구를 빠뜨린 것이 타입 에러로 드러난다.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  BLOCK_NOT_FOUND: '블록을 찾을 수 없어요. 이미 삭제됐을 수 있어요.',
  ELEMENT_NOT_FOUND: '요소를 찾을 수 없어요. 이미 삭제됐을 수 있어요.',
  LABEL_NOT_FOUND: '라벨을 찾을 수 없어요.',
  ELEMENT_VALUE_INVALID: '값을 확인해 주세요. 비어 있거나 날짜·시간 형식이 맞지 않아요.',
  CONFLICT_PREVIEW_STALE: '내용이 바뀌어서 다시 확인해 주세요.',
  CONFLICT_SELECTION_MISSING: '남길 요소를 다시 골라 주세요.',
  CONFLICT_SELECTION_INVALID: '남길 요소를 다시 골라 주세요.',
  CONFLICT_SELECTION_EMPTY: '종류마다 하나 이상 남겨 주세요.',
  CAPTURE_NOT_FOUND: '먹이를 찾을 수 없어요. 이미 닫혔을 수 있어요.',
  CAPTURE_NOT_RETRYABLE: '지금은 다시 시도할 수 없어요.',
  CAPTURE_EXTRACT_FAILED: '할 일을 뽑지 못했어요.',
  INTERRUPTED: '처리하지 못했어요. 다시 먹여 주세요.',
  INVALID_INPUT: GENERIC_ERROR_MESSAGE,
  INTERNAL_ERROR: GENERIC_ERROR_MESSAGE
}

/** 화면에 보여줄 문구. 코어 에러가 아니거나 알 수 없는 코드면 일반 문구 */
export function messageForError(error: unknown): string {
  if (error instanceof ApiError) return ERROR_MESSAGES[error.code] ?? GENERIC_ERROR_MESSAGE
  return GENERIC_ERROR_MESSAGE
}
