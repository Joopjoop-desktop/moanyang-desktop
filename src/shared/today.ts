/** 오늘 창 상태 (today:*, 설계 9.7) */

/** 투명도(%) 범위와 기본값 */
export const TODAY_OPACITY_MIN = 30
export const TODAY_OPACITY_MAX = 100
export const TODAY_OPACITY_DEFAULT = 90

export type TodayWindowState = {
  /** 30~100(%) */
  opacity: number
  /** 접혀 있으면 머리줄만 보인다 */
  collapsed: boolean
}
