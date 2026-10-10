import {
  TODAY_OPACITY_DEFAULT,
  TODAY_OPACITY_MAX,
  TODAY_OPACITY_MIN,
  type TodayWindowState
} from '@shared/today'

/**
 * 오늘 창 설정 값 정리. Electron에 의존하지 않는 순수 계산이라 테스트로 확인한다. (설계 9.7)
 * 설정 파일은 사람이 고칠 수도 있으므로, 읽은 값이 범위를 벗어나면 가까운 값으로 맞춘다.
 */

/** 설정 파일에 저장하는 오늘 창 값 (위치는 따로 저장) */
export type SavedToday = { height?: number; opacity?: number; collapsed?: boolean }

export type TodayLayout = TodayWindowState & {
  /** 펼쳤을 때 높이. 접혀 있어도 기억해 두었다가 펼칠 때 쓴다 */
  height: number
}

export function resolveTodayLayout(
  saved: SavedToday | undefined,
  sizes: { defaultHeight: number; minHeight: number }
): TodayLayout {
  return {
    height: Math.max(sizes.minHeight, Math.round(saved?.height ?? sizes.defaultHeight)),
    opacity: clampOpacity(saved?.opacity ?? TODAY_OPACITY_DEFAULT),
    collapsed: saved?.collapsed ?? false
  }
}

export function clampOpacity(opacity: number): number {
  return Math.min(TODAY_OPACITY_MAX, Math.max(TODAY_OPACITY_MIN, Math.round(opacity)))
}
