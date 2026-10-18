import { useDroppable } from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import type { CalendarEntryView } from '@shared/calendar'
import chevronLeft from '../../assets/icons/chevron-left.svg'
import chevronRight from '../../assets/icons/chevron-right.svg'
import taskChip from '../../assets/icons/task-chip.svg'
import taskChipDone from '../../assets/icons/task-chip-done.svg'
import { messageForError } from '../../api/errorMessages'
import { useCalendar } from '../../api/queries'
import type { DragData, DropData } from '../board/dnd/dropRules'
import { FillDnd } from '../fill/FillDnd'
import {
  dayOfMonth,
  inMonth,
  localToday,
  monthGrid,
  shiftMonth,
  type YearMonth
} from './calendarDates'
import { CalendarSidePanel, type PanelContent } from './CalendarSidePanel'
import styles from './CalendarView.module.css'
import { DateDropDialog, type DateDrop } from './DateDropDialog'
import { entriesOnDay, visibleWeek } from './visibleWeek'
import { layoutWeek, markTimeText, weekGridRows, type DayMark } from './weekLayout'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 스튜디오 가운데 월간 달력 + 오른쪽 패널. (설계 7.5, 9.6)
 * 시작일·마감일·시작~마감 기간 막대는 모두 "할 일 칩"(고양이 아이콘 + 제목)으로 그린다.
 * 마감일 칩은 왼쪽에 빨간 선, 완료는 회색 칩에 취소선, 확인 필요는 점선. (Figma Task_Calendar)
 * 오른쪽 패널은 항상 열려 있고 기본은 채워 주세요 목록이다.
 * 막대·표시를 누르면 블록 카드를, 날짜 칸이나 "+N개"를 누르면 그날의 블록 목록을 패널에 띄운다.
 * 목록의 한 줄 항목을 날짜 칸에 끌어다 놓으면 날짜 넣기 창을 띄운다(목록과 달력이 드래그 영역을 같이 쓴다).
 * 데이터는 화면에 보이는 6주 전체로 조회한다. 블록이 바뀌면 blocks:changed로 다시 불러온다.
 */
export function CalendarView(): React.JSX.Element {
  const today = localToday()
  const [shown, setShown] = useState<YearMonth>(() => monthOf(today))
  const [panel, setPanel] = useState<PanelContent>({ kind: 'list' })
  const [dateDrop, setDateDrop] = useState<DateDrop | null>(null)
  const grid = monthGrid(shown)
  const { data, error } = useCalendar(grid.from, grid.to)
  const entries = data ?? []

  const openBlock = (blockId: string): void => setPanel({ kind: 'block', blockId })
  const openDay = (date: string): void => setPanel({ kind: 'day', date })

  // 오늘 창의 "스튜디오에서 열기": 캘린더 항목을 누른 것과 같이 오른쪽에 블록 카드를 연다 (설계 9.6)
  useEffect(
    () => window.api.on('studio:openBlock', ({ blockId }) => setPanel({ kind: 'block', blockId })),
    []
  )

  return (
    <FillDnd onDropToDay={(blockId, date) => setDateDrop({ blockId, date })}>
      <div className={styles.layout}>
        <section className={styles.calendar}>
          <header className={styles.header}>
            <h2 className={styles.title}>
              {shown.year}년 {shown.month}월
            </h2>
            <div className={styles.nav}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="지난달"
                onClick={() => setShown(shiftMonth(shown, -1))}
              >
                <img src={chevronLeft} alt="" />
              </button>
              <button type="button" onClick={() => setShown(monthOf(today))}>
                오늘
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="다음달"
                onClick={() => setShown(shiftMonth(shown, 1))}
              >
                <img src={chevronRight} alt="" />
              </button>
            </div>
            {error && <span className={styles.error}>{messageForError(error)}</span>}
          </header>

          <div className={styles.weekdays}>
            {WEEKDAYS.map((name, col) => (
              <span key={name} className={weekdayClass(col)}>
                {name}
              </span>
            ))}
          </div>

          <div className={styles.weeks}>
            {grid.weeks.map((week) => (
              <WeekRow
                key={week[0]}
                week={week}
                entries={entries}
                shown={shown}
                today={today}
                onOpenBlock={openBlock}
                onOpenDay={openDay}
              />
            ))}
          </div>
        </section>

        <CalendarSidePanel
          content={panel}
          dayEntries={panel.kind === 'day' ? entriesOnDay(entries, panel.date) : []}
          onOpenBlock={openBlock}
          onBack={() => setPanel({ kind: 'list' })}
        />
      </div>
      {dateDrop && <DateDropDialog {...dateDrop} onClose={() => setDateDrop(null)} />}
    </FillDnd>
  )
}

function monthOf(date: string): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) }
}

/** 일요일(첫 칸)은 빨강, 토요일(마지막 칸)은 파랑. 요일 줄과 날짜 숫자가 같이 쓴다 */
function weekdayClass(col: number): string {
  if (col === 0) return styles.sunday
  if (col === 6) return styles.saturday
  return ''
}

type WeekRowProps = {
  week: string[]
  entries: CalendarEntryView[]
  shown: YearMonth
  today: string
  onOpenBlock: (blockId: string) => void
  onOpenDay: (date: string) => void
}

/**
 * 한 주: 맨 윗줄 날짜 숫자, 그 아래 막대 줄들(최대 3줄), 맨 아래 그날의 표시들(최대 3개)과 "+N개".
 * CSS grid의 열(1~7)과 줄로 막대와 칸을 같은 격자에 놓는다.
 */
function WeekRow({
  week,
  entries,
  shown,
  today,
  onOpenBlock,
  onOpenDay
}: WeekRowProps): React.JSX.Element {
  const layout = visibleWeek(layoutWeek(week, entries))
  const marksRow = layout.laneCount + 2

  return (
    <div className={styles.week} style={{ gridTemplateRows: weekGridRows(layout.laneCount) }}>
      {week.map((date, col) => (
        <DayCell
          key={date}
          date={date}
          className={[styles.day, inMonth(date, shown) ? '' : styles.otherMonth].join(' ')}
          style={{ gridColumn: col + 1, gridRow: `1 / span ${marksRow}` }}
          onOpen={() => onOpenDay(date)}
        />
      ))}

      {week.map((date, col) => (
        <span
          key={`n-${date}`}
          className={[
            styles.dayNumber,
            weekdayClass(col),
            inMonth(date, shown) ? '' : styles.dim,
            date === today ? styles.todayNumber : ''
          ].join(' ')}
          style={{ gridColumn: col + 1, gridRow: 1 }}
        >
          {dayOfMonth(date)}
        </span>
      ))}

      {layout.bars.map((bar) => (
        <button
          type="button"
          key={`${bar.entry.blockId}-${week[0]}`}
          className={[
            styles.bar,
            bar.entry.completed ? styles.completed : '',
            bar.continuesBefore ? styles.continuesBefore : '',
            bar.continuesAfter ? styles.continuesAfter : ''
          ].join(' ')}
          style={{
            gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
            gridRow: bar.lane + 2
          }}
          title={bar.entry.title}
          onClick={() => onOpenBlock(bar.entry.blockId)}
        >
          <img
            className={styles.chipIcon}
            src={bar.entry.completed ? taskChipDone : taskChip}
            alt=""
          />
          <span className={styles.chipText}>{bar.entry.title}</span>
        </button>
      ))}

      {layout.marks.map((day, col) => (
        <ul
          key={`m-${week[col]}`}
          className={styles.marks}
          style={{ gridColumn: col + 1, gridRow: marksRow }}
        >
          {day.map((item) => (
            <MarkItem
              key={`${item.entry.blockId}-${item.mark.elementId}`}
              item={item}
              onOpen={() => onOpenBlock(item.entry.blockId)}
            />
          ))}
          {layout.hidden[col] > 0 && (
            <li>
              <button type="button" className={styles.more} onClick={() => onOpenDay(week[col])}>
                +{layout.hidden[col]}개
              </button>
            </li>
          )}
        </ul>
      ))}
    </div>
  )
}

type DayCellProps = {
  date: string
  className: string
  style: React.CSSProperties
  onOpen: () => void
}

/** 날짜 칸. 누르면 그날의 블록 목록, 목록의 한 줄 항목을 놓으면 날짜 넣기 (설계 9.6) */
function DayCell({ date, className, style, onOpen }: DayCellProps): React.JSX.Element {
  const dropData: DropData = { kind: 'day', date }
  const { setNodeRef, isOver, active } = useDroppable({ id: `day:${date}`, data: dropData })
  // 블록을 끌 때만 강조한다. 요소는 달력에 놓아도 아무것도 하지 않는다
  const targeted = isOver && (active?.data.current as DragData | undefined)?.kind === 'block'

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={targeted ? `${className} ${styles.dropTarget}` : className}
      style={style}
      aria-label={`${date} 일정 보기`}
      onClick={onOpen}
    />
  )
}

const MARK_KIND_LABELS = { start: '시작', due: '마감', sameDay: '시작·마감' } as const

/**
 * 시작일은 보통 칩, 마감일과 같은 날 시작·마감은 왼쪽에 빨간 선이 있는 칩. 시간이 있으면 앞에 붙인다
 * (같은 날은 10:00~11:00). 누르면 블록 카드
 */
function MarkItem({ item, onOpen }: { item: DayMark; onOpen: () => void }): React.JSX.Element {
  const { entry, mark } = item
  const time = markTimeText(mark)
  return (
    <li>
      <button
        type="button"
        className={[
          styles.mark,
          mark.kind === 'start' ? styles.start : styles.due,
          entry.completed ? styles.completed : '',
          mark.needsConfirm ? styles.unconfirmed : ''
        ].join(' ')}
        title={`${MARK_KIND_LABELS[mark.kind]}: ${time ? `${time} ` : ''}${entry.title}`}
        onClick={onOpen}
      >
        <img className={styles.chipIcon} src={entry.completed ? taskChipDone : taskChip} alt="" />
        {time && <span className={styles.time}>{time}</span>}
        <span className={styles.chipText}>{entry.title}</span>
      </button>
    </li>
  )
}
