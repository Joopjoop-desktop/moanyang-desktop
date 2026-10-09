import type { IpcEvents } from '@shared/ipc'

/** 캐릭터 표정 (설계 9.7) */
export const MOODS = ['idle', 'eating', 'happy', 'confused', 'sad'] as const
export type Mood = (typeof MOODS)[number]

/** 추출 결과에 대한 잠깐의 반응 */
export type Reaction = {
  mood: Extract<Mood, 'happy' | 'confused' | 'sad'>
  /** 말풍선 */
  message: string
}

/** 반응을 보여주는 시간 */
export const REACTION_MS = 3_000

/** 추출 완료 → 다 먹음(블록 있음) / 갸우뚱(할 일 없음) */
export function reactionToCompleted(event: IpcEvents['capture:completed']): Reaction {
  const count = event.blockIds.length
  return count > 0
    ? { mood: 'happy', message: `${count}개 만들었어요` }
    : { mood: 'confused', message: '할 일이 안 보여요' }
}

/** 추출 실패 → 시무룩. 다시 시도할 수 있으면 스튜디오로 안내한다 */
export function reactionToFailed(event: IpcEvents['capture:failed']): Reaction {
  return {
    mood: 'sad',
    message: event.canRetry ? '못 먹었어요. 스튜디오에서 다시 시도해 주세요' : '못 먹었어요'
  }
}

/**
 * 지금 보여줄 표정. 반응이 떠 있는 동안은 반응이 먼저이고(다른 먹이를 먹는 중이어도),
 * 반응이 없으면 미완료 먹이가 있을 때 먹는 중, 없으면 기본.
 */
export function currentMood(unfinished: number, reaction: Reaction | null): Mood {
  if (reaction) return reaction.mood
  return unfinished > 0 ? 'eating' : 'idle'
}
