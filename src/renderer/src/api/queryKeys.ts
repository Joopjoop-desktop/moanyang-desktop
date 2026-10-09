import type { BlockListFilter } from '@shared/views'

/**
 * TanStack Query 캐시 이름표. 같은 이름표면 같은 데이터로 본다.
 * 앞부분이 같으면 한 번에 다시 불러올 수 있다. 예: ['blocks']는 모든 탭의 블록 목록.
 */
export const queryKeys = {
  blocks: ['blocks'] as const,
  blockList: (filter: BlockListFilter) => ['blocks', 'list', filter] as const,
  /** ['blocks']로 시작하므로 blocks:changed가 오면 달력도 다시 불러온다 (설계 7.5) */
  calendar: (from: string, to: string) => ['blocks', 'calendar', from, to] as const,
  failedCaptures: ['captures', 'failed'] as const,
  labels: ['labels'] as const
}

export type QueryKey = readonly unknown[]
