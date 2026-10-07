import { CAPTURE_TEXT_MAX_LENGTH, type CaptureView } from '@shared/captures'
import { ERROR_MESSAGES } from '../../api/errorMessages'

/**
 * 붙여넣은 글을 먹일 수 있는지. 먹일 수 없으면 안내 문구, 괜찮으면 null.
 * 원문은 고치지 않고 그대로 보낸다(설계 8.2). 여기서는 코어가 거절할 것만 미리 막는다.
 */
export function pasteProblem(text: string): string | null {
  if (text.trim() === '') return '먹일 글을 붙여넣어 주세요.'
  if (text.length > CAPTURE_TEXT_MAX_LENGTH) {
    const limit = String(CAPTURE_TEXT_MAX_LENGTH).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `${limit}자까지 먹일 수 있어요.`
  }
  return null
}

/** 추출이 끝났을 때 알림 (캐릭터 반응은 7단계) */
export function completedMessage(blockCount: number): string {
  return blockCount === 0 ? '할 일이 안 보여요.' : `블록 ${blockCount}개를 만들었어요.`
}

/** 실패 카드 문구. 원문이 남아 있지 않으면 다시 먹여 달라고 안내한다 (설계 8.2) */
export function failedCardMessage(capture: CaptureView): string {
  if (capture.errorCode === 'INTERRUPTED' || !capture.canRetry) return ERROR_MESSAGES.INTERRUPTED
  return ERROR_MESSAGES.CAPTURE_EXTRACT_FAILED
}
