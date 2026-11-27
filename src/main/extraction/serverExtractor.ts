import { ExtractError } from './errors'
import type { ExtractInput, Extractor } from './types'

/** 서버 응답을 기다리는 시간. 서버는 AI를 25초까지만 기다리므로 그보다 길게 둔다 (설계 8.9) */
export const SERVER_TIMEOUT_MS = 30_000

export const EXTRACT_PATH = '/api/extract'

export type ServerExtractorOptions = {
  /** 서버 주소. 예: "http://13.125.0.1:8000" (끝의 / 는 있어도 없어도 된다) */
  baseUrl: string
  /** Authorization: Bearer 뒤에 붙는 키 */
  apiKey: string
  timeoutMs?: number
  /** 테스트에서 가짜 응답을 넣을 때만 바꾼다 */
  fetch?: typeof fetch
}

/**
 * 우리 서버의 POST /api/extract를 부르는 추출기. 서버가 AI를 대신 부른다. (설계 8.9)
 * 요청 본문은 ExtractInput 그대로 보내고, 응답 검사는 다른 추출기와 같이 코어가 한다(8.5).
 *
 * 자동 재시도(retryable: true)는 AI 한도를 쓰지 않은 실패만:
 * 503(서버가 바빠 AI를 부르지 않음), 네트워크 끊김, 시간 초과.
 * 그 밖의 실패는 모두 바로 실패다. 사용자는 실패 카드에서 직접 다시 시도할 수 있다.
 * 에러 메시지는 기록용이며 원문을 넣지 않는다.
 */
export class ServerExtractor implements Extractor {
  private readonly url: string
  private readonly timeoutMs: number
  private readonly fetchFn: typeof fetch

  constructor(private readonly options: ServerExtractorOptions) {
    this.url = options.baseUrl.replace(/\/+$/, '') + EXTRACT_PATH
    this.timeoutMs = options.timeoutMs ?? SERVER_TIMEOUT_MS
    this.fetchFn = options.fetch ?? fetch
  }

  async extract(input: ExtractInput): Promise<unknown> {
    // 시간 제한은 응답 본문을 다 읽을 때까지 적용된다
    const signal = AbortSignal.timeout(this.timeoutMs)

    let response: Response
    let body: string
    try {
      response = await this.fetchFn(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify(input),
        signal
      })
      body = await response.text()
    } catch (error) {
      // 서버에 닿지 않았거나, 응답이 없거나, 받는 도중 끊겼다
      throw new ExtractError(`서버에 연결하지 못함: ${describeError(error)}`, true)
    }

    if (response.status === 503) {
      throw new ExtractError('서버가 바쁨 (503)', true)
    }
    if (response.status !== 200) {
      // 400·401(요청·키), 429·502·504(AI 한도·실패·늦음), 그 밖의 코드(서버 버그·잘못된 주소)
      throw new ExtractError(`서버 응답 ${response.status}`, false)
    }

    try {
      return JSON.parse(body) as unknown
    } catch {
      throw new ExtractError('서버 응답이 JSON이 아님', false)
    }
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.name === 'TimeoutError' ? '시간 초과' : error.message
  return String(error)
}
