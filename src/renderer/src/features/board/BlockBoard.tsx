import type { BlockListFilter } from '@shared/views'
import { messageForError } from '../../api/errorMessages'
import { useBlockList } from '../../api/queries'
import { BlockCard } from './BlockCard'
import styles from './BlockBoard.module.css'
import { TABS } from './tabs'

/** 오른쪽 블록 보드: 고른 탭의 블록 카드 목록 */
export function BlockBoard({ filter }: { filter: BlockListFilter }): React.JSX.Element {
  const { data, error } = useBlockList(filter)
  const tab = TABS.find((t) => t.filter === filter)

  return (
    <section className={styles.board}>
      <h2 className={styles.title}>{tab?.label}</h2>
      {error ? (
        <p className={styles.message}>{messageForError(error)}</p>
      ) : !data ? (
        <p className={styles.message}>불러오는 중…</p>
      ) : data.length === 0 ? (
        <p className={styles.message}>{tab?.empty}</p>
      ) : (
        <div className={styles.grid}>
          {data.map((block) => (
            <BlockCard key={block.id} block={block} />
          ))}
        </div>
      )}
    </section>
  )
}
