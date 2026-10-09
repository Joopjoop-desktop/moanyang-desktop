import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { CalendarEntryView } from '@shared/calendar'
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

/** 블록 하나 (휴지통 블록은 BLOCK_NOT_FOUND) */
export function useBlock(blockId: string): UseQueryResult<BlockView> {
  return useQuery({
    queryKey: queryKeys.block(blockId),
    queryFn: () => unwrap(window.api.block.get({ blockId }))
  })
}

/** 기간(양 끝 포함)과 겹치는 블록의 달력 표시 */
export function useCalendar(from: string, to: string): UseQueryResult<CalendarEntryView[]> {
  return useQuery({
    queryKey: queryKeys.calendar(from, to),
    queryFn: () => unwrap(window.api.calendar.list({ from, to }))
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
