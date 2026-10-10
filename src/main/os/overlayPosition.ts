/**
 * 오늘 창 위치 계산. Electron에 의존하지 않는 순수 계산이라 테스트로 확인한다. (설계 9.7)
 */

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Rect = Point & Size

/** 작업 영역 가장자리에서 띄우는 간격 */
export const OVERLAY_MARGIN = 24

/** 기본 위치: 주 모니터 작업 영역(작업표시줄을 뺀 곳) 오른쪽 위 */
export function defaultOverlayPosition(workArea: Rect, size: Size): Point {
  return {
    x: workArea.x + workArea.width - size.width - OVERLAY_MARGIN,
    y: workArea.y + OVERLAY_MARGIN
  }
}

/**
 * 저장된 위치를 쓸지 정한다. 창 가운데가 어느 모니터의 작업 영역에도 없으면
 * (모니터를 뺐거나 해상도가 바뀐 경우) 기본 위치로 돌린다.
 * 가운데를 기준으로 해서, 화면 가장자리에 반쯤 걸쳐 둔 위치는 그대로 둔다.
 */
export function resolveOverlayPosition(
  saved: Point | undefined,
  workAreas: readonly Rect[],
  primaryWorkArea: Rect,
  size: Size
): Point {
  if (saved) {
    const center = { x: saved.x + size.width / 2, y: saved.y + size.height / 2 }
    if (workAreas.some((area) => contains(area, center))) return saved
  }
  return defaultOverlayPosition(primaryWorkArea, size)
}

function contains(area: Rect, point: Point): boolean {
  return (
    point.x >= area.x &&
    point.x < area.x + area.width &&
    point.y >= area.y &&
    point.y < area.y + area.height
  )
}
