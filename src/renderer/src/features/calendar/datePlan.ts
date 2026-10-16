import type { BlockView, ElementView } from '@shared/views'

/**
 * 날짜 넣기 창 계산 (설계 9.6): 목록 블록을 달력 칸에 놓았을 때 무엇을 요청할지.
 * 화면과 코어 호출 없이 순수 계산만 해서 테스트로 확인한다.
 */

export const DATE_TYPES = ['start_date', 'due_date'] as const
export type DateType = (typeof DATE_TYPES)[number]

/** 창의 한 줄: 체크했는지 + 고른 날짜(YYYY-MM-DD, 비우면 '') */
export type DateChoice = { checked: boolean; date: string }
export type DateChoices = Record<DateType, DateChoice>

/** 블록에 지금 있는 그 종류의 날짜 요소 */
export type CurrentDate =
  | { kind: 'none' }
  | { kind: 'one'; element: ElementView }
  /** 합치기로 같은 종류가 여러 개 남음(설계 7.2). 어느 것을 바꿀지 정할 수 없다 */
  | { kind: 'many'; count: number }

export type DateRequest =
  | { kind: 'create'; blockId: string; type: DateType; dateValue: string }
  /** 시간은 그대로 둔다. 날짜를 고치면 코어가 원래 표현과 "확인 필요"를 지운다 */
  | { kind: 'update'; elementId: string; dateValue: string; timeValue: string | null }

export type DatePlan =
  | { ok: true; requests: DateRequest[] }
  | { ok: false; reason: 'nothingChecked' | 'emptyDate' | 'ambiguous' | 'startAfterDue' }

export function currentDate(block: BlockView, type: DateType): CurrentDate {
  const found = block.elements.filter((element) => element.type === type)
  if (found.length === 0) return { kind: 'none' }
  if (found.length === 1) return { kind: 'one', element: found[0] }
  return { kind: 'many', count: found.length }
}

/** 처음 상태: 두 줄 모두 놓은 날짜, 마감일만 체크. 마감일이 여러 개면 체크하지 않는다 */
export function initialChoices(block: BlockView, date: string): DateChoices {
  return {
    start_date: { checked: false, date },
    due_date: { checked: currentDate(block, 'due_date').kind !== 'many', date }
  }
}

/**
 * 체크한 줄마다: 그 종류가 없으면 추가, 하나면 날짜 바꾸기. 시작일 → 마감일 순.
 * 반영한 뒤의 시작일이 마감일보다 늦으면 막는다. 체크하지 않은 쪽은 블록에 있는 값으로 비교한다.
 */
export function planDates(block: BlockView, choices: DateChoices): DatePlan {
  const checked = DATE_TYPES.filter((type) => choices[type].checked)
  if (checked.length === 0) return { ok: false, reason: 'nothingChecked' }
  if (checked.some((type) => choices[type].date === '')) return { ok: false, reason: 'emptyDate' }
  if (checked.some((type) => currentDate(block, type).kind === 'many')) {
    return { ok: false, reason: 'ambiguous' }
  }

  const start = resultDate(block, choices, 'start_date')
  const due = resultDate(block, choices, 'due_date')
  if (start && due && start > due) return { ok: false, reason: 'startAfterDue' }

  return {
    ok: true,
    requests: checked.map((type): DateRequest => {
      const current = currentDate(block, type)
      const dateValue = choices[type].date
      return current.kind === 'one'
        ? {
            kind: 'update',
            elementId: current.element.id,
            dateValue,
            timeValue: current.element.timeValue
          }
        : { kind: 'create', blockId: block.id, type, dateValue }
    })
  }
}

/** 반영한 뒤 그 종류의 날짜. 비교할 수 없으면(없음, 원래 표현만, 여러 개) null */
function resultDate(block: BlockView, choices: DateChoices, type: DateType): string | null {
  if (choices[type].checked) return choices[type].date
  const current = currentDate(block, type)
  return current.kind === 'one' ? current.element.dateValue : null
}
