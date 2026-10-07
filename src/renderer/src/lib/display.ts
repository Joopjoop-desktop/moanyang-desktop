import type { ElementType } from '@shared/model'
import type { ElementView } from '@shared/views'

/** 요소 종류 이름 (화면 표시용) */
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  task: '할 일',
  detail: '상세',
  start_date: '시작일',
  due_date: '마감일',
  requester: '요청자',
  memo: '메모'
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 달력 날짜를 "10/9(금) 11:00"으로 보여준다. (설계 9.6)
 * 올해가 아니면 연도를 붙인다: "2027/1/5(화)".
 * dateValue는 시간대 없는 달력 날짜라 UTC 기준으로 요일만 계산한다(지역 시간대로 바꾸면 하루 밀릴 수 있음).
 */
export function formatCalendarDate(
  dateValue: string,
  timeValue: string | null,
  currentYear: number
): string {
  const [year, month, day] = dateValue.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  const date = year === currentYear ? `${month}/${day}` : `${year}/${month}/${day}`
  return timeValue ? `${date}(${weekday}) ${timeValue}` : `${date}(${weekday})`
}

export type ElementDisplay = {
  /** 크게 보여줄 값 */
  primary: string
  /** 작은 글씨로 함께 보여줄 원래 표현. 없으면 null */
  secondary: string | null
  needsConfirm: boolean
}

/**
 * 요소 하나를 화면에 어떻게 보여줄지 정한다. (설계 9.6)
 * - 글자 요소: 값
 * - 날짜 요소: 날짜 + 원래 표현(작게). 날짜 없이 표현만 있으면 표현을 크게 보여준다.
 */
export function describeElement(element: ElementView, currentYear: number): ElementDisplay {
  if (element.dateValue !== null) {
    return {
      primary: formatCalendarDate(element.dateValue, element.timeValue, currentYear),
      secondary: element.rawText,
      needsConfirm: element.needsConfirm
    }
  }
  if (element.type === 'start_date' || element.type === 'due_date') {
    return {
      primary: element.rawText ?? '날짜 없음',
      secondary: null,
      needsConfirm: element.needsConfirm
    }
  }
  return { primary: element.value ?? '', secondary: null, needsConfirm: element.needsConfirm }
}

/** 저장된 시각(UTC ISO)을 이 PC 시간으로 "10/7 14:03" */
export function formatTimestamp(iso: string): string {
  const at = new Date(iso)
  const minutes = String(at.getMinutes()).padStart(2, '0')
  return `${at.getMonth() + 1}/${at.getDate()} ${at.getHours()}:${minutes}`
}
