/**
 * 알림 쌓기 규칙. (설계 9.6)
 * 알림이 하나뿐이면 삭제 직후 다른 알림이 와서 되돌리기 버튼을 덮으므로 여러 개를 쌓는다.
 * - 최대 3개. 새 알림은 맨 아래(배열 끝)에 붙는다.
 * - 넘치면 버튼 없는 알림 중 가장 오래된 것부터 뺀다. 방금 들어온 알림은 빼지 않는다.
 * - 뺄 수 있는 게 없으면(먼저 쌓인 알림이 전부 버튼 있는 알림) 잠시 3개를 넘겨 둔다.
 *   각 알림이 시간이 지나 사라지면 다시 3개 이하로 돌아온다.
 */

export const TOAST_LIMIT = 3

/** 쌓기 규칙에 필요한 것: 버튼(예: 되돌리기)이 있는지 */
type Stackable = { action?: unknown }

export function pushToast<T extends Stackable>(stack: readonly T[], toast: T): T[] {
  const next = [...stack, toast]
  while (next.length > TOAST_LIMIT) {
    // 마지막(방금 들어온 알림)은 후보에서 뺀다
    const oldestPlain = next.findIndex((item, index) => !item.action && index < next.length - 1)
    if (oldestPlain === -1) break
    next.splice(oldestPlain, 1)
  }
  return next
}
