import { describe, expect, it } from 'vitest'
import { currentMood, reactionToCompleted, reactionToFailed } from './mood'

describe('캐릭터 표정 (설계 9.7)', () => {
  it('미완료 먹이가 있으면 먹는 중, 없으면 기본', () => {
    expect(currentMood(0, null)).toBe('idle')
    expect(currentMood(2, null)).toBe('eating')
  })

  it('반응이 떠 있으면 먹는 중보다 반응이 먼저다', () => {
    expect(currentMood(1, { mood: 'happy', message: '1개 만들었어요' })).toBe('happy')
  })

  it('블록이 생기면 다 먹음, 없으면 갸우뚱', () => {
    expect(reactionToCompleted({ captureId: 'c1', blockIds: ['b1', 'b2'] })).toEqual({
      mood: 'happy',
      message: '2개 만들었어요'
    })
    expect(reactionToCompleted({ captureId: 'c1', blockIds: [] })).toEqual({
      mood: 'confused',
      message: '할 일이 안 보여요'
    })
  })

  it('실패하면 시무룩. 다시 시도할 수 있으면 스튜디오로 안내한다', () => {
    expect(
      reactionToFailed({ captureId: 'c1', errorCode: 'CAPTURE_EXTRACT_FAILED', canRetry: true })
    ).toEqual({ mood: 'sad', message: '못 먹었어요. 스튜디오에서 다시 시도해 주세요' })
    expect(
      reactionToFailed({ captureId: 'c1', errorCode: 'INTERRUPTED', canRetry: false }).message
    ).toBe('못 먹었어요')
  })
})
