import { useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
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
      <div className="flex min-h-0 min-w-0 flex-1 gap-5.5 px-7 pt-6 pb-7">
        <section className="-m-1 flex min-w-0 flex-1 flex-col overflow-y-auto p-1">
          <header className="mb-5 flex h-7 shrink-0 items-center gap-4">
            <h2 className="text-[1.5rem] font-semibold whitespace-nowrap text-black">
              {shown.year}년 {shown.month}월
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={clsx(navButton, 'w-7 p-0')}
                aria-label="지난달"
                onClick={() => setShown(shiftMonth(shown, -1))}
              >
                <img src={chevronLeft} alt="" />
              </button>
              <button
                type="button"
                className={clsx(navButton, 'px-2 py-0')}
                onClick={() => setShown(monthOf(today))}
              >
                오늘
              </button>
              <button
                type="button"
                className={clsx(navButton, 'w-7 p-0')}
                aria-label="다음달"
                onClick={() => setShown(shiftMonth(shown, 1))}
              >
                <img src={chevronRight} alt="" />
              </button>
            </div>
            {error && <span className="text-[0.8125rem] text-warn">{messageForError(error)}</span>}
          </header>

          <div className="grid shrink-0 grid-cols-7 pb-2 text-center text-[1rem] font-semibold text-gray-90">
            {WEEKDAYS.map((name, col) => (
              <span key={name} className={weekdayTone(col)}>
                {name}
              </span>
            ))}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden rounded-[0.75rem] bg-surface shadow">
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

/** 2026년 10월 옆 [<] [오늘] [>] 버튼 */
const navButton = clsx(
  'flex h-7 cursor-pointer items-center justify-center rounded-[0.25rem] border-none bg-bg text-[1rem] font-semibold text-gray-80 shadow-button hover:bg-hover [&_img]:size-5'
)

/** 일요일(첫 칸)은 빨강, 토요일(마지막 칸)은 파랑. 요일 줄 글자 색 */
function weekdayTone(col: number): string | undefined {
  if (col === 0) return 'text-warn'
  if (col === 6) return 'text-accent'
  return undefined
}

/**
 * 날짜 숫자 색: 오늘(검은 원에 흰 글자) > 지난달·다음달(흐리게) > 일·토 색 > 기본.
 * 일·토는 흐릴 때도 빨강·파랑을 연하게 쓴다.
 */
function dayNumberTone(col: number, dim: boolean, today: boolean): string {
  if (today) return 'bg-gray-100 text-gray-00'
  if (dim) {
    if (col === 0) return 'text-[#f599a7]'
    if (col === 6) return 'text-[#a2b7f8]'
    return 'text-gray-50'
  }
  return weekdayTone(col) ?? 'text-text'
}

/**
 * 할 일 칩: 막대(여러 날)와 시작·마감 표시가 같은 모양을 쓴다 (Figma Task_Calendar).
 * 바탕·글자 색은 chipFill, 표시 칩 테두리는 markBorder가 정한다.
 */
const chipBase = clsx(
  'flex min-w-0 cursor-pointer items-center gap-1 rounded-[0.375rem] border p-1 text-left text-[0.75rem] hover:brightness-96'
)

/** 완료: 회색 칩에 취소선 (Figma Task_Calendar Off) */
function chipFill(completed: boolean): string {
  return completed ? 'bg-border text-gray-60 line-through' : 'bg-surface text-black'
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
      className="grid flex-1 grid-cols-7 gap-y-1"
      style={{ gridTemplateRows: weekGridRows(layout.laneCount) }}
    >
      {week.map((date, col) => (
        <DayCell
          key={date}
          date={date}
          otherMonth={!inMonth(date, shown)}
          style={{ gridColumn: col + 1, gridRow: `1 / span ${marksRow}` }}
          onOpen={() => onOpenDay(date)}
        />
      ))}

      {week.map((date, col) => (
        <span
          key={`n-${date}`}
          className={clsx(
            // 날짜 숫자: 24px 동그라미. 숫자 위를 눌러도 아래 날짜 칸이 눌리게 한다
            'pointer-events-none z-1 mt-2.5 ml-2.5 flex size-6 items-center justify-center rounded-[1.75rem] text-base/[1.375rem]',
            dayNumberTone(col, !inMonth(date, shown), date === today)
          )}
          style={{ gridColumn: col + 1, gridRow: 1 }}
        >
          {dayOfMonth(date)}
        </span>
      ))}

      {layout.bars.map((bar) => (
        <button
          type="button"
          key={`${bar.entry.blockId}-${week[0]}`}
          className={clsx(
            // 기간 막대 (누르면 블록 카드)
            chipBase,
            'z-1',
            chipFill(bar.entry.completed),
            bar.entry.completed ? 'border-transparent' : 'border-border',
            // 앞 주에서 이어지거나 다음 주로 이어지는 쪽은 둥글게 하지 않고 칸 끝까지 붙인다
            bar.continuesBefore ? 'ml-0 rounded-l-none' : 'ml-1',
            bar.continuesAfter ? 'mr-0 rounded-r-none' : 'mr-1'
          )}
          style={{
            gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
            gridRow: bar.lane + 2
          }}
          title={bar.entry.title}
          onClick={() => onOpenBlock(bar.entry.blockId)}
        >
          <img
            className="size-3 shrink-0"
            src={bar.entry.completed ? taskChipDone : taskChip}
            alt=""
          />
          <span className="min-w-0 flex-1 truncate">{bar.entry.title}</span>
        </button>
      ))}

      {layout.marks.map((day, col) => (
        <ul
          key={`m-${week[col]}`}
          className="pointer-events-none z-1 flex min-w-0 list-none flex-col gap-1 overflow-hidden px-1 pt-0 pb-1 [&>li]:min-w-0"
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
              <button
                type="button"
                className="inherit-font pointer-events-auto cursor-pointer border-none bg-transparent px-1 py-0 text-[0.75rem] text-muted hover:text-accent hover:underline"
                onClick={() => onOpenDay(week[col])}
              >
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
  /** 지난달·다음달 칸 */
  otherMonth: boolean
  style: React.CSSProperties
  onOpen: () => void
}

/** 날짜 칸. 누르면 그날의 블록 목록, 목록의 한 줄 항목을 놓으면 날짜 넣기 (설계 9.6) */
function DayCell({ date, otherMonth, style, onOpen }: DayCellProps): React.JSX.Element {
  const dropData: DropData = { kind: 'day', date }
  const { setNodeRef, isOver, active } = useDroppable({ id: `day:${date}`, data: dropData })
  // 블록을 끌 때만 강조한다. 요소는 달력에 놓아도 아무것도 하지 않는다
  const targeted = isOver && (active?.data.current as DragData | undefined)?.kind === 'block'

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={clsx(
        // 칸 배경. 칩은 이 위에 그린다
        'min-h-31 cursor-pointer border-none p-0',
        otherMonth ? 'bg-hover' : 'bg-surface',
        // 목록의 블록을 끌어 이 칸 위에 있을 때
        targeted && 'outline-2 -outline-offset-2 outline-accent'
      )}
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
        className={clsx(
          chipBase,
          // 칩 사이 빈 곳은 아래 날짜 칸이 받고, 칩만 직접 받는다
          'pointer-events-auto w-full',
          chipFill(entry.completed),
          markBorder(mark.kind !== 'start', mark.needsConfirm, entry.completed)
        )}
        title={`${MARK_KIND_LABELS[mark.kind]}: ${time ? `${time} ` : ''}${entry.title}`}
        onClick={onOpen}
      >
        <img className="size-3 shrink-0" src={entry.completed ? taskChipDone : taskChip} alt="" />
        {time && <span className="shrink-0 font-semibold">{time}</span>}
        <span className="min-w-0 flex-1 truncate">{entry.title}</span>
      </button>
    </li>
  )
}

/**
 * 표시 칩 테두리. 원래 CSS의 우선순위(마감 < 확인 필요 < 완료)를 그대로 따른다.
 * - 마감일: 왼쪽에 굵은 빨간 선 (3px)
 * - 확인 필요: 점선, 테두리 전체 빨강
 * - 완료: 테두리 전체 투명 (굵기·점선은 남는다)
 */
function markBorder(due: boolean, unconfirmed: boolean, completed: boolean): string {
  return clsx(
    due && 'border-l-3',
    unconfirmed && 'border-dashed',
    completed
      ? 'border-transparent'
      : unconfirmed
        ? 'border-warn'
        : due
          ? 'border-border border-l-warn'
          : 'border-border'
  )
}
