/** 캐릭터 표정 (설계 9.7). 이벤트 → 표정 계산은 7-4에서 붙인다. */
export const MOODS = ['idle', 'eating', 'happy', 'confused', 'sad'] as const
export type Mood = (typeof MOODS)[number]
