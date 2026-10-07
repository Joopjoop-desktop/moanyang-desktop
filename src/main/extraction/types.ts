/**
 * 코어 ↔ 추출기 사이의 형식. (설계 8.3, 8.4)
 * 화면은 이 형식을 몰라도 되므로 shared가 아니라 main 안에 둔다.
 */

export type ExtractInput = {
  /** 원문. 메모리에서만 쓰고 저장하지 않는다 (설계 8.2) */
  text: string
  /** 날짜 계산 기준 시각 (Capture.capturedAt) */
  capturedAt: string
  /** 예: "Asia/Seoul" */
  timezone: string
}

export type DateValue = {
  /** "2026-10-09" */
  date: string | null
  /** 시간 언급 시에만 "11:00" */
  time: string | null
  /** 원래 표현 "다음주 금요일까지" */
  rawText: string | null
  /** 해석이 애매하면 true → Element.needsConfirm */
  ambiguous: boolean
}

export type ExtractItem = {
  task: string | null
  detail: string | null
  requester: string | null
  startDate: DateValue | null
  dueDate: DateValue | null
}

export type ExtractOutput = {
  schemaVersion: 1
  /** 할 일이 없는 내용이면 true, items는 빈 배열 */
  notTask: boolean
  items: ExtractItem[]
}

/**
 * 추출기. MockExtractor(지금)와 DirectLlmExtractor(9단계)가 구현한다.
 * 결과를 믿지 않으므로 unknown으로 받고, 코어가 parseExtractOutput으로 검사한다. (설계 8.5)
 * 실패는 ExtractError로 던진다. 그 밖의 예외는 재시도할 수 없는 실패로 본다.
 */
export interface Extractor {
  extract(input: ExtractInput): Promise<unknown>
}
