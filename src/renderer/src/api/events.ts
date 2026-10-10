import type { IpcEvent } from '@shared/ipc'
import { queryKeys, type QueryKey } from './queryKeys'

/** 구독할 코어 이벤트 (설계 9.4) */
export const CORE_EVENTS = [
  'blocks:changed',
  'capture:completed',
  'capture:failed'
] as const satisfies readonly IpcEvent[]

/**
 * 이벤트를 받으면 다시 불러올 데이터. (설계 9.5)
 * 추출 성공은 blocks:changed와 capture:completed가 연달아 와서 목록을 두 번 부를 수 있지만,
 * 로컬 조회라 비용이 작고 결과도 같다.
 */
export function keysToRefresh(event: IpcEvent): QueryKey[] {
  switch (event) {
    case 'blocks:changed':
    case 'capture:completed':
      return [queryKeys.blocks]
    case 'capture:failed':
      return [queryKeys.failedCaptures]
    case 'capture:unfinishedChanged':
      // 오늘 창 서랍용. 다시 불러올 데이터는 없다
      return []
    case 'studio:openBlock':
      // 화면을 바꾸라는 신호일 뿐 데이터는 그대로다
      return []
  }
}
