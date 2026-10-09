import { useState } from 'react'
import type { CalendarEntryView } from '@shared/calendar'
import { messageForError } from '../../api/errorMessages'
import { useCalendar } from '../../api/queries'
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
import { entriesOnDay, visibleWeek } from './visibleWeek'
import { layoutWeek, type DayMark } from './weekLayout'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 스튜디오 가운데 월간 달력 + 오른쪽 패널. (설계 7.5, 9.6)
 * 시작일은 점, 마감일은 마감 표시, 시작~마감은 기간 막대. 완료는 흐리게, 확인 필요는 점선.
 * 오른쪽 패널은 항상 열려 있고 기본은 채워 주세요 목록이다.
 * 막대·표시를 누르면 블록 카드를, "+N개"를 누르면 그날의 블록 목록을 패널에 띄운다.
 * 데이터는 화면에 보이는 6주 전체로 조회한다. 블록이 바뀌면 blocks:changed로 다시 불러온다.
 */
export function CalendarView(): React.JSX.Element {
  const today = localToday()
  const [shown, setShown] = useState<YearMonth>(() => monthOf(today))
  const [panel, setPanel] = useState<PanelContent>({ kind: 'list' })
  const grid = monthGrid(shown)
  const { data, error } = useCalendar(grid.from, grid.to)
  const entries = data ?? []

  const openBlock = (blockId: string): void => setPanel({ kind: 'block', blockId })
  const openDay = (date: string): void => setPanel({ kind: 'day', date })

  return (
    <div className={styles.layout}>
      <section className={styles.calendar}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            {shown.year}년 {shown.month}월
          </h2>
          <div className={styles.nav}>
            <button
              type="button"
              aria-label="지난달"
              onClick={() => setShown(shiftMonth(shown, -1))}
            >
              ‹
            </button>
            <button type="button" onClick={() => setShown(monthOf(today))}>
              오늘
            </button>
            <button
              type="button"
              aria-label="다음달"
              onClick={() => setShown(shiftMonth(shown, 1))}
            >
              ›
            </button>
          </div>
          {error && <span className={styles.error}>{messageForError(error)}</span>}
        </header>

        <div className={styles.weekdays}>
          {WEEKDAYS.map((name) => (
            <span key={name}>{name}</span>
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
  )
}

function monthOf(date: string): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) }
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
    <div
      className={styles.week}
      // 날짜 숫자 줄, 막대 줄들, 표시 줄(남는 높이를 채운다)
      style={{ gridTemplateRows: `auto repeat(${layout.laneCount}, auto) 1fr` }}
    >
      {week.map((date, col) => (
        <div
          key={date}
          className={[
            styles.day,
            inMonth(date, shown) ? '' : styles.otherMonth,
            date === today ? styles.today : ''
          ].join(' ')}
          style={{ gridColumn: col + 1, gridRow: `1 / span ${marksRow}` }}
        />
      ))}

      {week.map((date, col) => (
        <span
          key={`n-${date}`}
          className={styles.dayNumber}
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
          {bar.entry.title}
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

/** 시작일은 점, 마감일은 마감 표시. 시간이 있으면 앞에 붙인다. 누르면 블록 카드 */
function MarkItem({ item, onOpen }: { item: DayMark; onOpen: () => void }): React.JSX.Element {
  const { entry, mark } = item
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
        title={`${mark.kind === 'start' ? '시작' : '마감'}: ${entry.title}`}
        onClick={onOpen}
      >
        {mark.time && <span className={styles.time}>{mark.time}</span>}
        <span className={styles.markTitle}>{entry.title}</span>
      </button>
    </li>
  )
}
