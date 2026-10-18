import type { BlockView } from '@shared/views'
import { formatTimestamp } from '../../lib/display'
import { blockTitle, missingChips } from '../fill/fillRules'
import styles from './BlockTitleLine.module.css'

type Props = {
  block: BlockView
  /** 펼친 카드는 시각 글자를 더 진하게 (Figma Main_Arcodian Menu Open) */
  open?: boolean
  /** false면 빠진 것 칩을 숨긴다 (날짜 없는 일 목록은 모두 "날짜 없음"이라 따로 표시하지 않는다) */
  showMissing?: boolean
}

/**
 * 카드 머리의 글자 부분: 제목 + 빠진 것 칩("날짜 없음", "할 일 없음") 한 줄, 아래에 시각 한 줄.
 * 목록의 한 줄 항목과 캘린더 옆 블록 카드가 같이 쓴다.
 */
export function BlockTitleLine({
  block,
  open = false,
  showMissing = true
}: Props): React.JSX.Element {
  const chips = showMissing ? missingChips(block) : []

  return (
    <div className={styles.text}>
      <div className={styles.titleRow}>
        <span className={styles.title}>{blockTitle(block)}</span>
        {chips.map((chip) => (
          <span key={chip.label} className={`${styles.chip} ${styles[chip.tone]}`}>
            {chip.label}
          </span>
        ))}
      </div>
      <span className={open ? `${styles.meta} ${styles.metaOpen}` : styles.meta}>
        {blockMetaText(block)}
      </span>
    </div>
  )
}

/** 삭제·완료된 블록은 그 시각과 상태, 아니면 만든 시각 */
function blockMetaText(block: BlockView): string {
  if (block.deletedAt) return `${formatTimestamp(block.deletedAt)} 삭제`
  if (block.completedAt) return `${formatTimestamp(block.completedAt)} 완료`
  return formatTimestamp(block.createdAt)
}
