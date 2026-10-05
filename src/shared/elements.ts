/** 요소 값 수정 (element:update). 텍스트 요소와 날짜 요소가 받는 값이 다르다. */
export type UpdateElementInput =
  /** task, detail, requester, memo */
  | { value: string }
  /** start_date, due_date. 시간이 없으면 null */
  | { dateValue: string; timeValue: string | null }
