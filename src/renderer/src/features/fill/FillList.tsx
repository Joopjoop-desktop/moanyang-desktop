import { DndContext } from '@dnd-kit/core'
import { useState } from 'react'
import type { BlockListFilter, BlockView } from '@shared/views'
import { messageForError } from '../../api/errorMessages'
import { useBlockList } from '../../api/queries'
import { BlockCard } from '../board/BlockCard'
import { blockTitle, missingLabel } from './fillRules'
import styles from './FillList.module.css'

const SECTIONS: readonly { filter: BlockListFilter; title: string; empty: string }[] = [
  { filter: 'needsInput', title: '채워 주세요', empty: '채울 블록이 없어요.' },
  { filter: 'undated', title: '날짜 없는 일', empty: '날짜 없이 둔 일이 없어요.' }
]

/**
 * 오른쪽 목록 패널: 채워 주세요 / 날짜 없는 일. (설계 7.6, 9.6)
 * 항목은 한 줄(제목 + 빠진 것). 누르면 그 자리에서 카드가 펼쳐지고, 한 번에 하나만 펼친다.
 * 빠진 것을 채우면 blocks:changed로 다시 불러와 항목이 저절로 빠진다.
 */
export function FillList(): React.JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null)
  const toggle = (blockId: string): void => setOpenId(openId === blockId ? null : blockId)

  return (
    <div className={styles.list}>
      {SECTIONS.map((section) => (
        <Section key={section.filter} {...section} openId={openId} onToggle={toggle} />
      ))}
    </div>
  )
}

type SectionProps = {
  filter: BlockListFilter
  title: string
  empty: string
  openId: string | null
  onToggle: (blockId: string) => void
}

function Section({ filter, title, empty, openId, onToggle }: SectionProps): React.JSX.Element {
  const { data, error } = useBlockList(filter)

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>
        {title}
        {data && data.length > 0 && <span className={styles.count}>{data.length}</span>}
      </h3>
      {error ? (
        <p className={styles.message}>{messageForError(error)}</p>
      ) : !data ? (
        <p className={styles.message}>불러오는 중…</p>
      ) : data.length === 0 ? (
        <p className={styles.message}>{empty}</p>
      ) : (
        <ul className={styles.rows}>
          {data.map((block) => (
            <Row
              key={block.id}
              block={block}
              // 날짜 없는 일은 모두 "날짜 없음"이라 따로 표시하지 않는다
              showMissing={filter === 'needsInput'}
              open={openId === block.id}
              onToggle={() => onToggle(block.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

type RowProps = {
  block: BlockView
  showMissing: boolean
  open: boolean
  onToggle: () => void
}

function Row({ block, showMissing, open, onToggle }: RowProps): React.JSX.Element {
  const missing = showMissing ? missingLabel(block) : null

  return (
    <li className={styles.row}>
      <button
        type="button"
        className={open ? `${styles.line} ${styles.open}` : styles.line}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={styles.arrow}>{open ? '▾' : '▸'}</span>
        <span className={styles.lineTitle}>{blockTitle(block)}</span>
        {missing && <span className={styles.missing}>{missing}</span>}
      </button>
      {open && (
        // BlockCard는 드래그 훅을 쓰므로 DndContext 안에 둔다(목록 드래그 전까지 끌기는 꺼 둔다)
        <DndContext>
          <BlockCard block={block} draggable={false} />
        </DndContext>
      )}
    </li>
  )
}
