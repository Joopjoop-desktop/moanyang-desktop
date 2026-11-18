import { CAPTURE_TEXT_MAX_LENGTH, type CaptureView } from '@shared/captures'
import type { IpcEvents } from '@shared/ipc'
import { ERROR_MESSAGES } from '@renderer/api/errorMessages'

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

type Completed = Pick<IpcEvents['capture:completed'], 'toCalendar' | 'needsInput'>

/**
 * 추출 결과를 짧은 문장들로. (설계 9.6, 9.7)
 * 캘린더로 바로 간 것과 채워야 하는 것을 따로 말한다. 블록이 없으면 "할 일이 안 보여요".
 * 스튜디오 알림과 오늘 창 서랍이 같이 쓴다.
 */
export function completedParts({ toCalendar, needsInput }: Completed): string[] {
  const parts: string[] = []
  if (toCalendar > 0) parts.push(`캘린더에 ${toCalendar}개 넣었어요`)
  if (needsInput > 0) parts.push(`${needsInput}개는 채워 주세요`)
  return parts.length > 0 ? parts : ['할 일이 안 보여요']
}

/** 추출이 끝났을 때 스튜디오 알림: 문장마다 마침표 */
export function completedMessage(event: Completed): string {
  return completedParts(event)
    .map((part) => `${part}.`)
    .join(' ')
}

/** 실패 카드 문구. 원문이 남아 있지 않으면 다시 먹여 달라고 안내한다 (설계 8.2) */
export function failedCardMessage(capture: CaptureView): string {
  if (capture.errorCode === 'INTERRUPTED' || !capture.canRetry) return ERROR_MESSAGES.INTERRUPTED
  return ERROR_MESSAGES.CAPTURE_EXTRACT_FAILED
}
