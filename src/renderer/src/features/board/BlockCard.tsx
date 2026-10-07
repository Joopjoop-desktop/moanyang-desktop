import type { BlockView } from '@shared/views'
import { formatTimestamp } from '../../lib/display'
import styles from './BlockCard.module.css'
import { ElementRow } from './ElementRow'

/** 블록 카드 (6-2: 보기만). 조작 버튼은 6-3, 요소 편집은 6-4, 드래그는 6-5에서 붙인다. */
export function BlockCard({ block }: { block: BlockView }): React.JSX.Element {
  const currentYear = new Date().getFullYear()

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <span className={styles.meta}>{headerText(block)}</span>
        {block.completedAt && <span className={styles.done}>완료</span>}
      </header>

      {block.labels.length > 0 && (
        <div className={styles.labels}>
          {block.labels.map((label) => (
            <span key={label.id} className={styles.label}>
              {label.name}
            </span>
          ))}
        </div>
      )}

      <ul className={styles.elements}>
        {block.elements.map((element) => (
          <ElementRow key={element.id} element={element} currentYear={currentYear} />
        ))}
      </ul>
    </article>
  )
}

function headerText(block: BlockView): string {
  if (block.deletedAt) return `${formatTimestamp(block.deletedAt)} 삭제`
  if (block.completedAt) return `${formatTimestamp(block.completedAt)} 완료`
  return formatTimestamp(block.createdAt)
}
