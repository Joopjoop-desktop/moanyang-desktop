import type { IpcEvents } from '@shared/ipc'
import { completedParts } from '@renderer/lib/captureRules'

/**
 * 서랍 문구 (설계 9.7). 이벤트·상태 → 문구는 순수 계산이라 테스트로 확인한다.
 * 캐릭터 표정(7단계)을 대신한다.
 */

/** 잠깐 보여주는 알림이 떠 있는 시간 */
export const NOTICE_MS = 3_000

/** done: 넣기 성공, empty: 할 일 없음, failed: 실패·거절 */
export type NoticeTone = 'done' | 'empty' | 'failed'
export type DrawerNotice = { tone: NoticeTone; message: string }

export const DRAWER_TEXT = {
  idle: '끌어다 놓거나 눌러서 Ctrl+V',
  dragOver: '여기에 놓아 주세요',
  paste: 'Ctrl+V로 넣어 주세요',
  working: '정리하는 중…'
} as const

/** 추출 완료: "캘린더에 N개 넣었어요" / "N개는 채워 주세요" (두 줄), 블록이 없으면 할 일 없음 */
export function noticeForCompleted(event: IpcEvents['capture:completed']): DrawerNotice {
  return {
    tone: event.blockIds.length > 0 ? 'done' : 'empty',
    message: completedParts(event).join('\n')
  }
}

/** 추출 실패. 다시 시도할 수 있으면 스튜디오로 안내한다 */
export function noticeForFailed(event: IpcEvents['capture:failed']): DrawerNotice {
  return {
    tone: 'failed',
    message: event.canRetry ? '못 넣었어요. 스튜디오에서 다시 시도해 주세요' : '못 넣었어요'
  }
}

export type DrawerState = {
  /** 글을 서랍 위로 끌고 있음 */
  dragOver: boolean
  /** 서랍을 눌러 Ctrl+V를 기다림 */
  pasteMode: boolean
  /** 떠 있는 알림 (3초) */
  notice: DrawerNotice | null
  /** 미완료 먹이 수 (대기 + 처리 중 + 자동 재시도 대기) */
  unfinished: number
}

/**
 * 지금 서랍에 보여줄 문구. 사용자가 하고 있는 일(끌기·붙여넣기)이 먼저,
 * 그다음 방금 끝난 결과 알림, 그다음 처리 중, 아무것도 없으면 안내.
 */
export function drawerText(state: DrawerState): { text: string; tone: NoticeTone | null } {
  if (state.dragOver) return { text: DRAWER_TEXT.dragOver, tone: null }
  if (state.pasteMode) return { text: DRAWER_TEXT.paste, tone: null }
  if (state.notice) return { text: state.notice.message, tone: state.notice.tone }
  if (state.unfinished > 0) return { text: DRAWER_TEXT.working, tone: null }
  return { text: DRAWER_TEXT.idle, tone: null }
}
