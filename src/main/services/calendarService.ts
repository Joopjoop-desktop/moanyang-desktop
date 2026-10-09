import type { CalendarEntryView } from '@shared/calendar'
import { overlapsRange, planBlockCalendar } from '../domain/calendar'
import { toDomainElement } from '../repositories/elementRepository'
import { inTransaction, type ServiceDeps } from './deps'
import { toCalendarEntryView } from './views'

/**
 * 달력 조회. (설계 7.5)
 * 저장소가 후보 블록을 넓게 고르고, 도메인이 표시를 계산한 뒤 조회 기간과 실제로 겹치는 것만 남긴다.
 * 삭제된 블록·요소는 저장소의 살아 있는 조건으로 빠진다. 아무것도 바꾸지 않는 조회다.
 */
export class CalendarService {
  constructor(private readonly deps: ServiceDeps) {}

  /** from~to(YYYY-MM-DD, 양 끝 포함). 형식·순서 검사는 IPC 입력 검증이 한다 */
  list(from: string, to: string): CalendarEntryView[] {
    return inTransaction(this.deps, (repos) =>
      repos.elements
        .findBlockIdsWithDatesAround(from, to)
        .flatMap((blockId) => {
          const block = repos.blocks.findLiveById(blockId)
          if (!block) return []
          const rows = repos.elements.findLiveByBlock(blockId)
          const calendar = planBlockCalendar(rows.map(toDomainElement))
          if (!calendar || !overlapsRange(calendar, from, to)) return []
          return [toCalendarEntryView(block, rows, calendar)]
        })
        .sort(byFirstDate)
    )
  }
}

/** 막대 시작(없으면 첫 표시) 날짜 순, 같으면 블록 ID 순 */
function byFirstDate(a: CalendarEntryView, b: CalendarEntryView): number {
  return firstDate(a).localeCompare(firstDate(b)) || a.blockId.localeCompare(b.blockId)
}

function firstDate(entry: CalendarEntryView): string {
  return entry.span?.start ?? entry.marks[0]?.date ?? ''
}
