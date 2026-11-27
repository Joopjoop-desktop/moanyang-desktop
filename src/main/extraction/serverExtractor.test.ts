import { describe, expect, it, vi, type Mock } from 'vitest'
import { ExtractError } from './errors'
import { parseExtractOutput } from './parseOutput'
import { ServerExtractor } from './serverExtractor'
import type { ExtractInput, ExtractOutput } from './types'

const input: ExtractInput = {
  text: '김대리님, 다음 주 화요일 3시까지 견적서 보내 주세요',
  capturedAt: '2026-11-16T01:20:00.000Z',
  timezone: 'Asia/Seoul'
}

const output: ExtractOutput = {
  schemaVersion: 1,
  notTask: false,
  items: [
    {
      task: '견적서 보내기',
      detail: null,
      requester: '김대리',
      startDate: null,
      dueDate: {
        date: '2026-11-24',
        time: '15:00',
        rawText: '다음 주 화요일 3시까지',
        ambiguous: false
      }
    }
  ]
}

/** 정해진 상태 코드와 본문을 돌려주는 가짜 fetch */
function respond(status: number, body: string): Mock<typeof fetch> {
  return vi.fn<typeof fetch>(async () => new Response(body, { status }))
}

function extractor(fetchFn: typeof fetch, timeoutMs?: number): ServerExtractor {
  return new ServerExtractor({
    baseUrl: 'http://server.test/',
    apiKey: 'demo-key',
    fetch: fetchFn,
    timeoutMs
  })
}

async function extractError(fetchFn: typeof fetch, timeoutMs?: number): Promise<ExtractError> {
  const error = await extractor(fetchFn, timeoutMs)
    .extract(input)
    .catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ExtractError)
  return error as ExtractError
}

describe('ServerExtractor (설계 8.9)', () => {
  it('POST /api/extract로 키 헤더와 ExtractInput을 그대로 보낸다', async () => {
    const fetchFn = respond(200, JSON.stringify(output))

    await extractor(fetchFn).extract(input)

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    // 주소 끝의 / 는 한 번만 붙는다
    expect(url).toBe('http://server.test/api/extract')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer demo-key'
    })
    expect(JSON.parse(init?.body as string)).toEqual(input)
  })

  it('200이면 응답 본문을 그대로 돌려주고, 코어 검사(8.5)를 통과한다', async () => {
    const raw = await extractor(respond(200, JSON.stringify(output))).extract(input)

    expect(raw).toEqual(output)
    expect(parseExtractOutput(raw)).toMatchObject([
      { task: '견적서 보내기', dueDate: { date: '2026-11-24', time: '15:00' } }
    ])
  })

  it('503(서버가 바빠 AI를 부르지 않음)은 자동 재시도한다', async () => {
    expect((await extractError(respond(503, ''))).retryable).toBe(true)
  })

  it('서버에 닿지 않으면 자동 재시도한다', async () => {
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed')
    })

    expect((await extractError(offline)).retryable).toBe(true)
  })

  it('응답이 시간 안에 오지 않으면 자동 재시도한다', async () => {
    // 끊기 신호가 올 때까지 응답하지 않는 서버
    const hanging = vi.fn<typeof fetch>(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init?.signal?.reason))
        })
    )

    const error = await extractError(hanging, 20)

    expect(error.retryable).toBe(true)
    expect(error.message).toContain('시간 초과')
  })

  it.each([400, 401, 429, 502, 504, 500, 404])(
    '%i는 AI 한도를 썼거나 다시 보내도 같으므로 바로 실패한다',
    async (status) => {
      const error = await extractError(respond(status, '{"error":"X","message":"y"}'))

      expect(error.retryable).toBe(false)
      expect(error.message).toContain(String(status))
    }
  )

  it('200인데 본문이 JSON이 아니면 바로 실패한다', async () => {
    expect((await extractError(respond(200, '<html>오류</html>'))).retryable).toBe(false)
  })

  it('에러 메시지에 원문을 넣지 않는다', async () => {
    const error = await extractError(respond(400, ''))

    expect(error.message).not.toContain('견적서')
  })
})
