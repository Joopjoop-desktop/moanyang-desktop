import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExtractError } from './errors'
import { MockExtractor } from './mockExtractor'
import { parseExtractOutput } from './parseOutput'
import type { ExtractInput } from './types'

function input(text: string): ExtractInput {
  return { text, capturedAt: '2026-10-07T00:00:00.000Z', timezone: 'Asia/Seoul' }
}

const extractor = new MockExtractor()

async function extractError(text: string): Promise<ExtractError> {
  const error = await extractor.extract(input(text)).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ExtractError)
  return error as ExtractError
}

describe('MockExtractor (설계 8.8)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('빈 줄로 나눈 문단마다 item 하나. 첫 줄은 할 일, 나머지는 상세', async () => {
    const result = await extractor.extract(
      input('견적서 송부\n단가표 첨부\n부가세 포함\n\n  \n회의실 예약')
    )

    expect(result.notTask).toBe(false)
    expect(result.items).toMatchObject([
      { task: '견적서 송부', detail: '단가표 첨부\n부가세 포함', dueDate: null },
      { task: '회의실 예약', detail: null, dueDate: null }
    ])
  })

  it('날짜(·시간)는 마감일이 되고 할 일 글자에서 빠진다', async () => {
    const result = await extractor.extract(input('보고서 제출 2026-10-09 11:00\n\n결재 2026-10-12'))

    expect(result.items).toMatchObject([
      {
        task: '보고서 제출',
        dueDate: { date: '2026-10-09', time: '11:00', rawText: '2026-10-09 11:00' }
      },
      { task: '결재', dueDate: { date: '2026-10-12', time: null, ambiguous: false } }
    ])
  })

  it('[할일없음]이면 notTask', async () => {
    expect(await extractor.extract(input('[할일없음] 점심 뭐 먹지'))).toEqual({
      schemaVersion: 1,
      notTask: true,
      items: []
    })
  })

  it('빈 텍스트도 notTask', async () => {
    expect((await extractor.extract(input('  \n\n '))).notTask).toBe(true)
  })

  it('[실패]는 재시도할 수 없는 실패, [네트워크]는 재시도할 수 있는 실패', async () => {
    expect((await extractError('[실패] 견적서')).retryable).toBe(false)
    expect((await extractError('[네트워크] 견적서')).retryable).toBe(true)
  })

  it('[애매]이면 날짜 ambiguous를 켜고 글자에서는 뺀다', async () => {
    const result = await extractor.extract(input('[애매]견적서 송부 2026-10-09'))

    expect(result.items).toMatchObject([
      { task: '견적서 송부', dueDate: { date: '2026-10-09', ambiguous: true } }
    ])
  })

  it('없는 날짜도 그대로 내보내고, 검증에서 걸러진다', async () => {
    const raw = await extractor.extract(input('견적서 송부 2026-02-30'))

    expect(parseExtractOutput(raw)).toMatchObject([
      { task: '견적서 송부', dueDate: { date: null, rawText: '2026-02-30', ambiguous: true } }
    ])
  })

  it('지연 시간이 지나야 응답한다', async () => {
    vi.useFakeTimers()
    const slow = new MockExtractor({ delayMs: 1500 })
    let done = false
    const pending = slow.extract(input('견적서 송부')).then(() => {
      done = true
    })

    await vi.advanceTimersByTimeAsync(1499)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(done).toBe(true)
  })
})
