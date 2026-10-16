/** 달력 표시 (calendar:list 응답, 설계 7.5) */

/**
 * 날짜 하나에 찍는 표시: 시작일은 점, 마감일은 마감 표시,
 * 같은 날 시작일·마감일 한 쌍은 같은 날 표시(sameDay) 하나 (설계 7.5)
 */
export type CalendarMarkView = {
  kind: 'start' | 'due' | 'sameDay'
  /** sameDay는 마감일 요소 */
  elementId: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm, 없으면 null. sameDay는 시작 시각 */
  time: string | null
  /** sameDay의 마감 시각(HH:mm, 없으면 null). 다른 종류는 null */
  endTime: string | null
  /** 점선 테두리로 그린다 */
  needsConfirm: boolean
}

/** 블록 하나의 달력 표시 */
export type CalendarEntryView = {
  blockId: string
  /** 할 일 → 요청자 → 상세 → "(할 일 없음)" */
  title: string
  /** 완료한 블록은 흐리게 */
  completed: boolean
  /** 기간 막대 (양 끝 포함). 시작일과 마감일이 다 있고 시작일이 마감일보다 이를 때만 */
  span: { start: string; end: string } | null
  /** 날짜가 있는 시작일·마감일 전부 (날짜·시간 순). 막대가 있어도 그대로 있다 */
  marks: CalendarMarkView[]
}
