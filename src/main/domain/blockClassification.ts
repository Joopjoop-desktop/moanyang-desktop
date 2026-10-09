import type { MissingEssential } from '@shared/views'
import type { DomainElement } from './types'

/**
 * 블록 분류: 캘린더 / 채워 주세요 / 날짜 없는 일. (설계 7.6)
 * 필수는 할 일 + 날짜. 분류는 상태가 아니라 조건이라, 빠진 것을 채우면 저절로 목록에서 빠진다.
 * 캘린더에 나오는지는 planBlockCalendar(7.5)가 정한다. 날짜가 "확인 필요"인 블록은
 * 캘린더에 점선으로 나오면서 채워 주세요에도 나온다.
 * 삭제·완료한 블록은 목록에 나오지 않는다(서비스가 후보에서 뺀다). 삭제된 요소는 넘기지 않는다.
 */

export type BlockClassification = {
  /** 빠진 것 (task → date → dateConfirm 순) */
  missing: MissingEssential[]
  /** 채워 주세요 목록에 나온다 */
  needsInput: boolean
  /** 날짜 없는 일 목록에 나온다 */
  undated: boolean
}

/** 블록의 요소로 빠진 것을 찾는다 */
export function findMissing(elements: readonly DomainElement[]): MissingEssential[] {
  const missing: MissingEssential[] = []
  if (!elements.some((element) => element.type === 'task')) missing.push('task')

  const dated = elements.filter(isDatedElement)
  if (dated.length === 0) missing.push('date')
  else if (dated.some((element) => element.needsConfirm)) missing.push('dateConfirm')

  return missing
}

/**
 * 블록이 어느 목록에 나오는지 정한다.
 * - 채워 주세요: 할 일 없음, 또는 날짜 확인 필요, 또는 (날짜 없음 + 이대로 두기 안 함)
 * - 날짜 없는 일: 할 일 있음 + 날짜 없음 + 이대로 두기 함
 * reviewed(이대로 두기)는 "날짜 없음" 판단에만 쓴다. 이대로 두기 한 블록도 할 일이 지워지면
 * 다시 채워 주세요에 나온다.
 */
export function classifyBlock(
  elements: readonly DomainElement[],
  reviewed: boolean
): BlockClassification {
  const missing = findMissing(elements)
  const noTask = missing.includes('task')
  const noDate = missing.includes('date')

  return {
    missing,
    needsInput: noTask || missing.includes('dateConfirm') || (noDate && !reviewed),
    undated: !noTask && noDate && reviewed
  }
}

/** 실제 날짜가 있는 시작일·마감일. 원래 표현만 있는 요소(dateValue null)는 날짜로 치지 않는다 */
function isDatedElement(element: DomainElement): boolean {
  return (
    (element.type === 'start_date' || element.type === 'due_date') && element.dateValue !== null
  )
}
