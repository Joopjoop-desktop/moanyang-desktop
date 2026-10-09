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
import styles from './CalendarView.module.css'
import { layoutWeek, type DayMark } from './weekLayout'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 캘린더 탭: 월간 달력. (설계 7.5)
 * 시작일은 점, 마감일은 마감 표시, 시작~마감은 기간 막대. 완료는 흐리게, 확인 필요는 점선.
 * 데이터는 화면에 보이는 6주 전체로 조회한다. 블록이 바뀌면 blocks:changed로 다시 불러온다.
 */
export function CalendarView(): React.JSX.Element {
  const today = localToday()
  const [shown, setShown] = useState<YearMonth>(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7))
  }))
  const grid = monthGrid(shown)
  const { data, error } = useCalendar(grid.from, grid.to)

  return (
    <section className={styles.calendar}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          {shown.year}년 {shown.month}월
        </h2>
        <div className={styles.nav}>
          <button type="button" aria-label="지난달" onClick={() => setShown(shiftMonth(shown, -1))}>
            ‹
          </button>
          <button
            type="button"
            onClick={() =>
              setShown({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })
            }
          >
            오늘
          </button>
          <button type="button" aria-label="다음달" onClick={() => setShown(shiftMonth(shown, 1))}>
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
          <WeekRow key={week[0]} week={week} entries={data ?? []} shown={shown} today={today} />
        ))}
      </div>
    </section>
  )
}

type WeekRowProps = {
  week: string[]
  entries: CalendarEntryView[]
  shown: YearMonth
  today: string
}

/**
 * 한 주: 맨 윗줄 날짜 숫자, 그 아래 막대 줄들, 맨 아래 그날의 표시들.
 * CSS grid의 열(1~7)과 줄로 막대와 칸을 같은 격자에 놓는다.
 */
function WeekRow({ week, entries, shown, today }: WeekRowProps): React.JSX.Element {
  const layout = layoutWeek(week, entries)
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
        <div
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
        >
          {bar.entry.title}
        </div>
      ))}

      {layout.marks.map((day, col) => (
        <ul
          key={`m-${week[col]}`}
          className={styles.marks}
          style={{ gridColumn: col + 1, gridRow: marksRow }}
        >
          {day.map((item) => (
            <MarkItem key={`${item.entry.blockId}-${item.mark.elementId}`} item={item} />
          ))}
        </ul>
      ))}
    </div>
  )
}

/** 시작일은 점, 마감일은 마감 표시. 시간이 있으면 앞에 붙인다 */
function MarkItem({ item }: { item: DayMark }): React.JSX.Element {
  const { entry, mark } = item
  return (
    <li
      className={[
        styles.mark,
        mark.kind === 'start' ? styles.start : styles.due,
        entry.completed ? styles.completed : '',
        mark.needsConfirm ? styles.unconfirmed : ''
      ].join(' ')}
      title={`${mark.kind === 'start' ? '시작' : '마감'}: ${entry.title}`}
    >
      {mark.time && <span className={styles.time}>{mark.time}</span>}
      <span className={styles.markTitle}>{entry.title}</span>
    </li>
  )
}
