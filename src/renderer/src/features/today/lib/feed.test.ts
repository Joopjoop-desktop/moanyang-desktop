import { describe, expect, it } from 'vitest'
import { CAPTURE_TEXT_MAX_LENGTH } from '@shared/captures'
import { checkFeed, NOT_TEXT_MESSAGE } from './feed'

describe('서랍 먹이 확인 (설계 9.7)', () => {
  it('글은 고치지 않고 그대로 먹인다', () => {
    expect(checkFeed({ fileCount: 0, text: '  견적서 송부\n' })).toEqual({
      ok: true,
      text: '  견적서 송부\n'
    })
  })

  it('파일·이미지가 섞여 있으면 거절한다', () => {
    expect(checkFeed({ fileCount: 1, text: '' })).toEqual({ ok: false, message: NOT_TEXT_MESSAGE })
    expect(checkFeed({ fileCount: 2, text: '사진 설명' })).toEqual({
      ok: false,
      message: NOT_TEXT_MESSAGE
    })
  })

  it('글이 없거나 공백뿐이면 거절한다', () => {
    expect(checkFeed({ fileCount: 0, text: '' })).toEqual({ ok: false, message: NOT_TEXT_MESSAGE })
    expect(checkFeed({ fileCount: 0, text: ' \n ' })).toEqual({
      ok: false,
      message: NOT_TEXT_MESSAGE
    })
  })

  it('너무 긴 글은 스튜디오와 같은 기준으로 거절한다', () => {
    expect(checkFeed({ fileCount: 0, text: 'a'.repeat(CAPTURE_TEXT_MAX_LENGTH + 1) })).toEqual({
      ok: false,
      message: '20,000자까지 먹일 수 있어요.'
    })
  })
})
