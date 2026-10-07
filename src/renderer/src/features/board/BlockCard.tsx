import type { BlockView } from '@shared/views'
import { formatTimestamp } from '../../lib/display'
import { BlockActionBar } from './BlockActionBar'
import styles from './BlockCard.module.css'
import { ElementRow } from './ElementRow'
import { LabelPicker } from './LabelPicker'

/** 블록 카드. 요소 편집은 6-4, 드래그는 6-5에서 붙인다. */
export function BlockCard({ block }: { block: BlockView }): React.JSX.Element {
  const currentYear = new Date().getFullYear()

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <span className={styles.meta}>{headerText(block)}</span>
        {block.completedAt && <span className={styles.done}>완료</span>}
      </header>

      <LabelPicker block={block} />

      <ul className={styles.elements}>
        {block.elements.map((element) => (
          <ElementRow key={element.id} element={element} currentYear={currentYear} />
        ))}
      </ul>

      <footer className={styles.footer}>
        <BlockActionBar block={block} />
      </footer>
    </article>
  )
}

function headerText(block: BlockView): string {
  if (block.deletedAt) return `${formatTimestamp(block.deletedAt)} 삭제`
  if (block.completedAt) return `${formatTimestamp(block.completedAt)} 완료`
  return formatTimestamp(block.createdAt)
}
