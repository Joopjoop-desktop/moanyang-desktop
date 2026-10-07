import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { CaptureView } from '@shared/captures'
import type { BlockListFilter, BlockView, LabelView } from '@shared/views'
import { unwrap } from './client'
import { queryKeys } from './queryKeys'

/* 화면이 읽는 데이터. 바뀌면 코어 이벤트(useCoreEvents)가 다시 불러오게 한다. */

export function useBlockList(filter: BlockListFilter): UseQueryResult<BlockView[]> {
  return useQuery({
    queryKey: queryKeys.blockList(filter),
    queryFn: () => unwrap(window.api.block.list({ filter }))
  })
}

export function useFailedCaptures(): UseQueryResult<CaptureView[]> {
  return useQuery({
    queryKey: queryKeys.failedCaptures,
    queryFn: () => unwrap(window.api.capture.listFailed())
  })
}

export function useLabels(): UseQueryResult<LabelView[]> {
  return useQuery({
    queryKey: queryKeys.labels,
    queryFn: () => unwrap(window.api.label.list())
  })
}
