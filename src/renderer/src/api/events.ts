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
      // 캐릭터 표정용. 스튜디오가 다시 불러올 데이터는 없다
      return []
  }
}
