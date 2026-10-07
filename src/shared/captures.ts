import type { ErrorCode } from './errors'
import type { CaptureMethod, CaptureStatus } from './model'

/** capture:submit 원문 최대 길이. 넘으면 INVALID_INPUT (설계 8.2) */
export const CAPTURE_TEXT_MAX_LENGTH = 20_000

/** Capture.errorCode에 저장되는 코드 */
export type CaptureErrorCode = Extract<ErrorCode, 'CAPTURE_EXTRACT_FAILED' | 'INTERRUPTED'>

/** 먹이 하나의 상태. 실패 카드와 submit·retry 응답에 쓴다. 원문은 담지 않는다. */
export type CaptureView = {
  id: string
  method: CaptureMethod
  status: CaptureStatus
  errorCode: CaptureErrorCode | null
  capturedAt: string
  /** 원문이 메모리에 있어 "다시 시도"를 할 수 있는지 */
  canRetry: boolean
}
