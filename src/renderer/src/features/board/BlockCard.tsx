import type { BlockView } from '@shared/views'
import { formatTimestamp } from '../../lib/display'
import { BlockActionBar } from './BlockActionBar'
import styles from './BlockCard.module.css'
import { ElementRow } from './ElementRow'
import { LabelPicker } from './LabelPicker'
import { MemoComposer } from './MemoComposer'

/** 블록 카드. 드래그는 6-5에서 붙인다. 휴지통 블록은 복구 말고는 보기만 한다. */
export function BlockCard({ block }: { block: BlockView }): React.JSX.Element {
  const currentYear = new Date().getFullYear()
  const editable = block.deletedAt === null

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <span className={styles.meta}>{headerText(block)}</span>
        {block.completedAt && <span className={styles.done}>완료</span>}
      </header>

      <LabelPicker block={block} />

      <ul className={styles.elements}>
        {block.elements.map((element) => (
          <ElementRow
            key={element.id}
            element={element}
            currentYear={currentYear}
            editable={editable}
            isLast={block.elements.length === 1}
          />
        ))}
      </ul>

      {editable && <MemoComposer blockId={block.id} />}

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
