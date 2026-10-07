import type { BlockListFilter } from '@shared/views'

/**
 * TanStack Query 캐시 이름표. 같은 이름표면 같은 데이터로 본다.
 * 앞부분이 같으면 한 번에 다시 불러올 수 있다. 예: ['blocks']는 모든 탭의 블록 목록.
 */
export const queryKeys = {
  blocks: ['blocks'] as const,
  blockList: (filter: BlockListFilter) => ['blocks', 'list', filter] as const,
  failedCaptures: ['captures', 'failed'] as const,
  labels: ['labels'] as const
}

export type QueryKey = readonly unknown[]
