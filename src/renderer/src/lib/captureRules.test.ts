import { describe, expect, it } from 'vitest'
import { CAPTURE_TEXT_MAX_LENGTH, type CaptureView } from '@shared/captures'
import { completedMessage, failedCardMessage, pasteProblem } from './captureRules'

function capture(overrides: Partial<CaptureView>): CaptureView {
  return {
    id: 'c1',
    method: 'paste',
    status: 'failed',
    errorCode: 'CAPTURE_EXTRACT_FAILED',
    capturedAt: '2026-10-07T00:00:00.000Z',
    canRetry: true,
    ...overrides
  }
}

describe('먹이 입력과 실패 카드 (설계 8.2, 9.6)', () => {
  it('비어 있거나 너무 긴 글은 보내기 전에 막는다', () => {
    expect(pasteProblem('  \n ')).toBe('먹일 글을 붙여넣어 주세요.')
    expect(pasteProblem('a'.repeat(CAPTURE_TEXT_MAX_LENGTH + 1))).toBe(
      '20,000자까지 먹일 수 있어요.'
    )
    expect(pasteProblem('a'.repeat(CAPTURE_TEXT_MAX_LENGTH))).toBeNull()
    expect(pasteProblem(' 견적서 송부 ')).toBeNull()
  })

  it('추출이 끝나면 캘린더로 간 수와 채워야 하는 수를, 할 일이 없으면 그렇다고 알려준다', () => {
    expect(completedMessage({ toCalendar: 2, needsInput: 1 })).toBe(
      '캘린더에 2개 넣었어요. 1개는 채워 주세요.'
    )
    expect(completedMessage({ toCalendar: 2, needsInput: 0 })).toBe('캘린더에 2개 넣었어요.')
    expect(completedMessage({ toCalendar: 0, needsInput: 1 })).toBe('1개는 채워 주세요.')
    expect(completedMessage({ toCalendar: 0, needsInput: 0 })).toBe('할 일이 안 보여요.')
  })

  it('다시 시도할 수 있는 실패와 다시 먹여야 하는 실패를 구분한다', () => {
    expect(failedCardMessage(capture({}))).toBe('할 일을 뽑지 못했어요.')
    expect(failedCardMessage(capture({ errorCode: 'INTERRUPTED', canRetry: false }))).toBe(
      '처리하지 못했어요. 다시 먹여 주세요.'
    )
    // 같은 실패라도 원문이 메모리에 없으면 다시 먹여야 한다
    expect(failedCardMessage(capture({ canRetry: false }))).toBe(
      '처리하지 못했어요. 다시 먹여 주세요.'
    )
  })
})
