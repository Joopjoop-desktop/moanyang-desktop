import { useState } from 'react'
import { TODAY_OPACITY_MAX, TODAY_OPACITY_MIN } from '@shared/today'
import { formatCalendarDate } from '../lib/display'
import { readTransfer, type FeedInput } from './feed'
import styles from './TodayWindow.module.css'
import type { TodayWindowControls } from './useTodayWindow'

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

/**
 * 오늘 창 머리줄 (설계 9.7). 창 테두리와 합쳐 40px = 접었을 때 창 높이(코어 TODAY_COLLAPSED_HEIGHT).
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
      <header className={styles.header} title="끌어서 옮기기">
        {controls.collapsed ? (
          // 접혀 있을 때는 글자 부분이 서랍 대신 먹이를 받는다. 끌기 영역에서는 놓기를 받을 수 없어
          // 이 부분만 끌기에서 빼고, 나머지 빈 곳으로 창을 옮긴다
          <span
            className={dropOver ? `${styles.dropTarget} ${styles.dropOver}` : styles.dropTarget}
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
            {remaining > 0 && <span className={styles.badge}>{remaining}</span>}
          </span>
        ) : (
          <span className={styles.heading}>오늘 {date}</span>
        )}
        {controls.collapsed && <span className={styles.spacer} />}
        {!controls.collapsed && (
          <button
            type="button"
            className={settingsOpen ? `${styles.iconButton} ${styles.active}` : styles.iconButton}
            aria-label="투명도"
            aria-expanded={settingsOpen}
            onClick={onToggleSettings}
          >
            ⚙
          </button>
        )}
        <button
          type="button"
          className={styles.iconButton}
          aria-label={controls.collapsed ? '펼치기' : '접기'}
          onClick={controls.toggleCollapsed}
        >
          {controls.collapsed ? '▸' : '▾'}
        </button>
      </header>

      {settingsOpen && !controls.collapsed && (
        <label className={styles.settings}>
          투명도
          <input
            type="range"
            min={TODAY_OPACITY_MIN}
            max={TODAY_OPACITY_MAX}
            value={controls.opacity}
            onChange={(e) => controls.previewOpacity(Number(e.target.value))}
            // 끄는 동안은 화면에만 반영하고, 놓았을 때(마우스·키보드) 저장한다
            onPointerUp={controls.saveOpacity}
            onKeyUp={controls.saveOpacity}
          />
          <span className={styles.settingsValue}>{controls.opacity}%</span>
        </label>
      )}
    </>
  )
}
