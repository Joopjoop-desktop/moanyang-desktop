import { describe, expect, it } from 'vitest'
import { ExtractError } from './errors'
import { parseExtractOutput } from './parseOutput'
import type { DateValue, ExtractItem } from './types'

function item(overrides: Partial<ExtractItem> = {}): ExtractItem {
  return {
    task: '견적서 송부',
    detail: null,
    requester: null,
    startDate: null,
    dueDate: null,
    ...overrides
  }
}

function date(overrides: Partial<DateValue> = {}): DateValue {
  return { date: '2026-10-09', time: null, rawText: '금요일까지', ambiguous: false, ...overrides }
}

function output(items: ExtractItem[], notTask = false): unknown {
  return { schemaVersion: 1, notTask, items }
}

function expectNotRetryable(raw: unknown): void {
  let caught: unknown
  try {
    parseExtractOutput(raw)
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(ExtractError)
  expect((caught as ExtractError).retryable).toBe(false)
}

describe('parseExtractOutput 구조 검사 (설계 8.5)', () => {
  it('정상 출력은 그대로 돌려준다', () => {
    const items = [item({ requester: '김대리', dueDate: date({ time: '11:00' }) })]

    expect(parseExtractOutput(output(items))).toEqual(items)
  })

  it('필드가 빠지거나 타입이 틀리면 재시도할 수 없는 실패', () => {
    expectNotRetryable({ schemaVersion: 1, notTask: false })
    expectNotRetryable(output([{ ...item(), task: 123 } as unknown as ExtractItem]))
    expectNotRetryable(output([item({ dueDate: { date: '2026-10-09' } as DateValue })]))
  })

  it('schemaVersion이 다르면 실패', () => {
    expectNotRetryable({ schemaVersion: 2, notTask: false, items: [item()] })
  })

  it('객체가 아니면 실패', () => {
    expectNotRetryable(null)
    expectNotRetryable('{"schemaVersion":1}')
  })
})

describe('parseExtractOutput 정리', () => {
  it('글자 앞뒤 공백을 지우고 빈 문자열은 null로 바꾼다', () => {
    const [result] = parseExtractOutput(
      output([item({ task: '  견적서 송부 ', detail: '   ', requester: '' })])
    )

    expect(result).toMatchObject({ task: '견적서 송부', detail: null, requester: null })
  })

  it('notTask이면 items가 있어도 빈 배열', () => {
    expect(parseExtractOutput(output([item()], true))).toEqual([])
  })

  it('내용이 모두 빈 item은 버리고, 남은 게 없으면 빈 배열', () => {
    const empty = item({ task: ' ', dueDate: date({ date: null, rawText: null }) })

    expect(parseExtractOutput(output([empty, item()]))).toEqual([item()])
    expect(parseExtractOutput(output([empty]))).toEqual([])
  })

  it('할 일 없이 날짜만 있는 item도 남긴다', () => {
    const onlyDate = item({ task: null, dueDate: date() })

    expect(parseExtractOutput(output([onlyDate]))).toEqual([onlyDate])
  })
})

describe('parseExtractOutput 날짜·시간 유효성', () => {
  function dueDateOf(value: DateValue): DateValue | null {
    return parseExtractOutput(output([item({ dueDate: value })]))[0].dueDate
  }

  it('없는 날짜는 비우고 확인 필요를 켠다. 원래 표현은 남긴다', () => {
    expect(dueDateOf(date({ date: '2026-02-30', time: '11:00' }))).toEqual({
      date: null,
      time: null,
      rawText: '금요일까지',
      ambiguous: true
    })
  })

  it('없는 날짜에 원래 표현이 없으면 틀린 값을 원래 표현으로 남긴다', () => {
    expect(dueDateOf(date({ date: '2026-13-01', rawText: null }))).toEqual({
      date: null,
      time: null,
      rawText: '2026-13-01',
      ambiguous: true
    })
  })

  it('틀린 시간은 버리고 확인 필요를 켠다. 날짜는 남긴다', () => {
    expect(dueDateOf(date({ time: '24:00' }))).toEqual({
      date: '2026-10-09',
      time: null,
      rawText: '금요일까지',
      ambiguous: true
    })
  })

  it('날짜 없이 시간만 있으면 시간을 버린다', () => {
    expect(dueDateOf(date({ date: null, time: '11:00', rawText: '오전 11시' }))).toEqual({
      date: null,
      time: null,
      rawText: '오전 11시',
      ambiguous: true
    })
  })

  it('날짜를 정하지 못하고 표현만 있으면 확인 필요를 켠다', () => {
    expect(dueDateOf(date({ date: null, rawText: '다음주쯤', ambiguous: false }))).toMatchObject({
      date: null,
      rawText: '다음주쯤',
      ambiguous: true
    })
  })

  it('날짜와 원래 표현이 모두 없으면 날짜 값은 null', () => {
    expect(dueDateOf(date({ date: null, time: '11:00', rawText: '  ' }))).toBeNull()
  })

  it('맞는 날짜·시간은 ambiguous를 그대로 둔다', () => {
    expect(dueDateOf(date({ time: '23:59', ambiguous: false }))).toMatchObject({
      date: '2026-10-09',
      time: '23:59',
      ambiguous: false
    })
  })
})
