import { ExtractError } from './errors'
import type { ExtractInput, ExtractItem, ExtractOutput, Extractor } from './types'

export type MockExtractorOptions = {
  /** 응답 전 지연. 개발 모드에서 처리 중 상태를 보기 위해 쓴다. 테스트는 0 */
  delayMs: number
}

/** 문단 구분: 빈 줄(공백만 있는 줄 포함) */
const PARAGRAPH_SEPARATOR = /\r?\n[ \t]*\r?\n/
/** "2026-10-09" 또는 "2026-10-09 11:00". 값이 맞는지는 검사하지 않는다(검증은 8.5에서) */
const DATE_PATTERN = /(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/

/**
 * 진짜 AI 대신 규칙으로 동작하는 개발용 추출기. (설계 8.8)
 * - 빈 줄로 나눈 문단 하나 = item 하나. 첫 줄은 할 일, 나머지 줄은 상세
 * - 날짜(·시간)가 있으면 마감일. 할 일·상세 글자에서는 날짜를 뺀다
 * - [할일없음] notTask / [실패] 재시도 불가 실패 / [네트워크] 재시도 가능 실패 / [애매] ambiguous
 */
export class MockExtractor implements Extractor {
  constructor(private readonly options: MockExtractorOptions = { delayMs: 0 }) {}

  async extract(input: ExtractInput): Promise<ExtractOutput> {
    if (this.options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.options.delayMs))
    }

    const { text } = input
    if (text.includes('[실패]')) throw new ExtractError('MockExtractor: [실패] 표시', false)
    if (text.includes('[네트워크]')) throw new ExtractError('MockExtractor: [네트워크] 표시', true)
    if (text.includes('[할일없음]')) return { schemaVersion: 1, notTask: true, items: [] }

    const ambiguous = text.includes('[애매]')
    const items = text
      .replaceAll('[애매]', '')
      .split(PARAGRAPH_SEPARATOR)
      .map((paragraph) => toItem(paragraph, ambiguous))
      .filter((item): item is ExtractItem => item !== null)

    return { schemaVersion: 1, notTask: items.length === 0, items }
  }
}

function toItem(paragraph: string, ambiguous: boolean): ExtractItem | null {
  const match = DATE_PATTERN.exec(paragraph)
  const body = match ? paragraph.replace(match[0], '') : paragraph
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')

  if (lines.length === 0 && !match) return null

  return {
    task: lines[0] ?? null,
    detail: lines.length > 1 ? lines.slice(1).join('\n') : null,
    requester: null,
    startDate: null,
    dueDate: match ? { date: match[1], time: match[2] ?? null, rawText: match[0], ambiguous } : null
  }
}
