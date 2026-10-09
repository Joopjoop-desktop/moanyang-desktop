import type { Mood } from './mood'
import styles from './Character.module.css'

/**
 * 임시 캐릭터 그림 (설계 9.7). 동그란 몸에 표정만 바꾼다. 나중에 이미지로 바꿔 끼운다.
 * viewBox 100×100 기준으로 그린다.
 */
export function Character({ mood }: { mood: Mood }): React.JSX.Element {
  return (
    <svg
      className={`${styles.character} ${styles[mood]}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={MOOD_LABELS[mood]}
    >
      <ellipse className={styles.body} cx="50" cy="56" rx="42" ry="38" />
      <ellipse className={styles.cheek} cx="24" cy="64" rx="7" ry="4" />
      <ellipse className={styles.cheek} cx="76" cy="64" rx="7" ry="4" />
      <Face mood={mood} />
    </svg>
  )
}

const MOOD_LABELS: Record<Mood, string> = {
  idle: '줍줍 캐릭터',
  eating: '먹는 중',
  happy: '다 먹었어요',
  confused: '할 일이 안 보여요',
  sad: '먹지 못했어요'
}

function Face({ mood }: { mood: Mood }): React.JSX.Element {
  switch (mood) {
    case 'eating':
      return (
        <g className={styles.line}>
          {/* 눈 감고 냠냠 */}
          <path d="M30 50 q6 -5 12 0" />
          <path d="M58 50 q6 -5 12 0" />
          <ellipse className={`${styles.mouth} ${styles.chew}`} cx="50" cy="68" rx="7" ry="5" />
        </g>
      )
    case 'happy':
      return (
        <g className={styles.line}>
          <path d="M30 52 l6 -6 l6 6" />
          <path d="M58 52 l6 -6 l6 6" />
          <path className={styles.mouth} d="M38 64 q12 12 24 0 z" />
        </g>
      )
    case 'confused':
      return (
        <g className={styles.line}>
          <circle className={styles.eye} cx="36" cy="50" r="4" />
          <path d="M58 50 h12" />
          <path d="M42 70 q4 -4 8 0 q4 4 8 0" />
          <text className={styles.mark} x="80" y="24">
            ?
          </text>
        </g>
      )
    case 'sad':
      return (
        <g className={styles.line}>
          <circle className={styles.eye} cx="36" cy="52" r="4" />
          <circle className={styles.eye} cx="64" cy="52" r="4" />
          <path d="M40 74 q10 -8 20 0" />
          <path className={styles.tear} d="M68 60 q-3 6 0 8 q3 -2 0 -8 z" />
        </g>
      )
    case 'idle':
      return (
        <g className={styles.line}>
          <circle className={styles.eye} cx="36" cy="50" r="4" />
          <circle className={styles.eye} cx="64" cy="50" r="4" />
          <path d="M42 66 q8 6 16 0" />
        </g>
      )
  }
}
