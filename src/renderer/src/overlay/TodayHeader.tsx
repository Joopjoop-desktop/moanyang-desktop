import { TODAY_OPACITY_MAX, TODAY_OPACITY_MIN } from '@shared/today'
import { formatCalendarDate } from '../lib/display'
import styles from './TodayWindow.module.css'
import type { TodayWindowControls } from './useTodayWindow'

type Props = {
  today: string
  /** 안 끝낸 일 수 (접혀 있을 때 보여준다) */
  remaining: number
  controls: TodayWindowControls
  settingsOpen: boolean
  onToggleSettings: () => void
}

/**
 * 오늘 창 머리줄 (설계 9.7). 창 테두리와 합쳐 40px = 접었을 때 창 높이(코어 TODAY_COLLAPSED_HEIGHT).
 * 빈 곳을 잡고 끌면 창이 움직인다. 버튼은 끌기에서 빼 둔다.
 * ⚙를 누르면 아래에 투명도 슬라이더가 열린다.
 */
export function TodayHeader({
  today,
  remaining,
  controls,
  settingsOpen,
  onToggleSettings
}: Props): React.JSX.Element {
  const date = formatCalendarDate(today, null, Number(today.slice(0, 4)))

  return (
    <>
      <header className={styles.header} title="끌어서 옮기기">
        <span className={styles.heading}>
          오늘 {date}
          {controls.collapsed && remaining > 0 && <span className={styles.badge}>{remaining}</span>}
        </span>
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
