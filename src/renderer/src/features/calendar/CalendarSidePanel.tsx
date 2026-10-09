import { DndContext } from '@dnd-kit/core'
import type { CalendarEntryView } from '@shared/calendar'
import { ApiError } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { useBlock } from '../../api/queries'
import { BlockCard } from '../board/BlockCard'
import { dayOfMonth } from './calendarDates'
import styles from './CalendarSidePanel.module.css'

/** 오른쪽 패널에 보여줄 것: 블록 하나, 또는 하루에 걸린 블록 목록("+N개") */
export type PanelContent = { kind: 'block'; blockId: string } | { kind: 'day'; date: string }

type Props = {
  content: PanelContent
  /** 하루 목록을 그릴 때 쓰는 그날의 블록들 */
  dayEntries: CalendarEntryView[]
  onOpenBlock: (blockId: string) => void
  onClose: () => void
}

/**
 * 캘린더 오른쪽 패널. (설계 7.5 화면)
 * 블록 카드는 6단계 BlockCard를 그대로 써서 날짜 수정·완료·라벨을 그 자리에서 한다.
 * 달력에서는 끌어서 옮기지 않으므로 카드의 끌기는 끈다.
 */
export function CalendarSidePanel({
  content,
  dayEntries,
  onOpenBlock,
  onClose
}: Props): React.JSX.Element {
  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.heading}>
          {content.kind === 'day' ? dayHeading(content.date) : '블록'}
        </span>
        <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </header>
      {content.kind === 'block' ? (
        <BlockDetail blockId={content.blockId} />
      ) : (
        <ul className={styles.dayList}>
          {dayEntries.map((entry) => (
            <li key={entry.blockId}>
              <button
                type="button"
                className={entry.completed ? `${styles.item} ${styles.completed}` : styles.item}
                onClick={() => onOpenBlock(entry.blockId)}
              >
                {entry.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

/** 블록 카드. 삭제되면(휴지통) 찾을 수 없다고 알려준다. 되돌리기로 복구하면 다시 나온다. */
function BlockDetail({ blockId }: { blockId: string }): React.JSX.Element {
  const { data, error } = useBlock(blockId)

  if (error) {
    const gone = error instanceof ApiError && error.code === 'BLOCK_NOT_FOUND'
    return (
      <p className={styles.message}>
        {gone ? '블록이 휴지통으로 갔거나 다른 블록에 합쳐졌어요.' : messageForError(error)}
      </p>
    )
  }
  if (!data) return <p className={styles.message}>불러오는 중…</p>

  // BlockCard는 드래그 훅을 쓰므로 DndContext 안에 둔다(끌기는 꺼져 있다)
  return (
    <DndContext>
      <BlockCard block={data} draggable={false} />
    </DndContext>
  )
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "10월 9일 (금)" */
function dayHeading(date: string): string {
  const month = Number(date.slice(5, 7))
  const [year, , day] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${month}월 ${dayOfMonth(date)}일 (${weekday})`
}
