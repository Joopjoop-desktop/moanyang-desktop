import { DndContext } from '@dnd-kit/core'
import type { CalendarEntryView } from '@shared/calendar'
import { ApiError } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { useBlock } from '../../api/queries'
import { BlockCard } from '../board/BlockCard'
import { FillList } from '../fill/FillList'
import { dayOfMonth } from './calendarDates'
import styles from './CalendarSidePanel.module.css'

/**
 * 오른쪽 패널에 보여줄 것 (설계 9.6)
 * - list: 채워 주세요 / 날짜 없는 일 목록 (기본)
 * - block: 캘린더에서 누른 블록 하나
 * - day: 하루에 걸린 블록 목록(날짜 칸, "+N개")
 */
export type PanelContent =
  { kind: 'list' } | { kind: 'block'; blockId: string } | { kind: 'day'; date: string }

type Props = {
  content: PanelContent
  /** 하루 목록을 그릴 때 쓰는 그날의 블록들 */
  dayEntries: CalendarEntryView[]
  onOpenBlock: (blockId: string) => void
  /** "← 목록": 목록으로 돌아간다 */
  onBack: () => void
}

/**
 * 스튜디오 오른쪽 패널. 항상 열려 있고 기본은 목록이다. (설계 7.5, 9.6)
 * 블록 카드는 BlockCard를 그대로 써서 그 자리에서 수정한다. 카드에서 삭제·완료하면 목록으로 돌아간다.
 */
export function CalendarSidePanel({
  content,
  dayEntries,
  onOpenBlock,
  onBack
}: Props): React.JSX.Element {
  return (
    <aside className={styles.panel}>
      {content.kind === 'list' ? (
        <FillList />
      ) : (
        <>
          <header className={styles.header}>
            <button type="button" className={styles.back} onClick={onBack}>
              ← 목록
            </button>
            {content.kind === 'day' && (
              <span className={styles.heading}>{dayHeading(content.date)}</span>
            )}
          </header>
          {content.kind === 'block' ? (
            <BlockDetail blockId={content.blockId} onLeave={onBack} />
          ) : dayEntries.length === 0 ? (
            <p className={styles.message}>이 날은 일정이 없어요.</p>
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
        </>
      )}
    </aside>
  )
}

/**
 * 블록 카드. 삭제·완료하면 목록으로 돌아간다(onLeave).
 * 그사이 다른 곳에서 지워지거나 합쳐지면 찾을 수 없다고 알려준다.
 */
function BlockDetail({
  blockId,
  onLeave
}: {
  blockId: string
  onLeave: () => void
}): React.JSX.Element {
  const { data, error } = useBlock(blockId)

  if (error) {
    const gone = error instanceof ApiError && error.code === 'BLOCK_NOT_FOUND'
    return (
      <p className={styles.message}>
        {gone ? '블록이 삭제됐거나 다른 블록에 합쳐졌어요.' : messageForError(error)}
      </p>
    )
  }
  if (!data) return <p className={styles.message}>불러오는 중…</p>

  // BlockCard는 드래그 훅을 쓰므로 DndContext 안에 둔다(끌기는 꺼져 있다)
  return (
    <DndContext>
      <BlockCard
        block={data}
        draggable={false}
        onAction={(action) => {
          if (action === 'delete' || action === 'complete') onLeave()
        }}
      />
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
