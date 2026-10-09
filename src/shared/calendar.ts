/** 달력 표시 (calendar:list 응답, 설계 7.5) */

/** 날짜 하나에 찍는 표시: 시작일은 점, 마감일은 마감 표시 */
export type CalendarMarkView = {
  kind: 'start' | 'due'
  elementId: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm, 없으면 null */
  time: string | null
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
  /** 기간 막대 (양 끝 포함). 시작일과 마감일이 다 있고 뒤집히지 않았을 때만 */
  span: { start: string; end: string } | null
  /** 날짜가 있는 시작일·마감일 전부 (날짜·시간 순). 막대가 있어도 그대로 있다 */
  marks: CalendarMarkView[]
}
