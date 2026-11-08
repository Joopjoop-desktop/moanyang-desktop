import clsx from 'clsx'
import { useState } from 'react'
import { TODAY_OPACITY_MAX, TODAY_OPACITY_MIN } from '@shared/today'
import chevronDownLight from '@renderer/assets/icons/chevron-down-light.svg'
import cogLight from '@renderer/assets/icons/cog-light.svg'
import { formatCalendarDate } from '@renderer/lib/display'
import { readTransfer, type FeedInput } from '@renderer/features/today/lib/feed'
import type { TodayWindowControls } from '@renderer/features/today/hooks/useTodayWindow'

type Props = {
  today: string
  /** 안 끝낸 일 수 (접혀 있을 때 보여준다) */
  remaining: number
  controls: TodayWindowControls
  settingsOpen: boolean
  onToggleSettings: () => void
  /** 접혀 있을 때 머리줄에 놓은 것을 먹인다 */
  onFeed: (input: FeedInput) => void
}

/** 머리줄 버튼은 끌기 영역에서 빼야 누를 수 있다 */
const iconButton = clsx(
  'flex size-5 cursor-pointer items-center justify-center border-none bg-transparent p-0 app-no-drag hover:opacity-70 [&_img]:size-5'
)

/**
 * 오늘 창 머리줄 (설계 9.7). 52px = 접었을 때 창 높이(코어 TODAY_COLLAPSED_HEIGHT).
 * 빈 곳을 잡고 끌면 창이 움직인다. 버튼은 끌기에서 빼 둔다.
 * ⚙를 누르면 아래에 투명도 슬라이더가 열린다. 접혀 있으면 글자 부분에 글을 놓아 먹일 수 있다.
 */
export function TodayHeader({
  today,
  remaining,
  controls,
  settingsOpen,
  onToggleSettings,
  onFeed
}: Props): React.JSX.Element {
  const date = formatCalendarDate(today, null, Number(today.slice(0, 4)))
  const [dropOver, setDropOver] = useState(false)

  return (
    <>
      <header
        className="flex h-[52px] shrink-0 cursor-grab items-center gap-3 bg-primary px-5 text-primary-text app-drag"
        title="끌어서 옮기기"
      >
        {controls.collapsed ? (
          // 접혀 있을 때는 글자 부분이 서랍 대신 먹이를 받는다. 끌기 영역에서는 놓기를 받을 수 없어
          // 이 부분만 끌기에서 빼고, 나머지 빈 곳으로 창을 옮긴다
          <span
            className={clsx(
              '-ml-2 flex min-w-0 cursor-default items-center gap-2 rounded border border-dashed px-2 py-1 text-[1.25rem] font-semibold whitespace-nowrap app-no-drag',
              dropOver ? 'border-bg bg-[rgba(249,249,249,0.16)]' : 'border-transparent'
            )}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
            onDragEnter={() => setDropOver(true)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropOver(false)
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDropOver(false)
              onFeed(readTransfer(event.dataTransfer))
            }}
          >
            오늘 {date}
            {remaining > 0 && (
              <span className="min-w-5.5 rounded-[62.4375rem] bg-bg px-1.75 text-center text-[0.8125rem]/[1.375rem] text-primary">
                {remaining}
              </span>
            )}
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[1.25rem] font-semibold whitespace-nowrap">
            오늘 {date}
          </span>
        )}
        {controls.collapsed && <span className="flex-1 self-stretch" />}
        {!controls.collapsed && (
          <button
            type="button"
            className={clsx(iconButton, settingsOpen && 'opacity-70')}
            aria-label="투명도"
            aria-expanded={settingsOpen}
            onClick={onToggleSettings}
          >
            <img src={cogLight} alt="" />
          </button>
        )}
        <button
          type="button"
          className={iconButton}
          aria-label={controls.collapsed ? '펼치기' : '접기'}
          onClick={controls.toggleCollapsed}
        >
          {/* 펼쳐져 있으면 아래 화살표, 접혀 있으면 오른쪽으로 눕힌다 */}
          <img
            src={chevronDownLight}
            alt=""
            className={controls.collapsed ? '-rotate-90' : undefined}
          />
        </button>
      </header>

      {settingsOpen && !controls.collapsed && (
        <label className="flex shrink-0 items-center gap-2 px-5 pt-3 pb-0 text-[0.75rem] text-muted">
          투명도
          <input
            type="range"
            className="min-w-0 flex-1"
            min={TODAY_OPACITY_MIN}
            max={TODAY_OPACITY_MAX}
            value={controls.opacity}
            onChange={(e) => controls.previewOpacity(Number(e.target.value))}
            // 끄는 동안은 화면에만 반영하고, 놓았을 때(마우스·키보드) 저장한다
            onPointerUp={controls.saveOpacity}
            onKeyUp={controls.saveOpacity}
          />
          <span className="w-8.5 text-right">{controls.opacity}%</span>
        </label>
      )}
    </>
  )
}
