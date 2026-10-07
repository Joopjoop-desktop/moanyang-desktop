import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '@shared/errors'
import { ApiError } from './client'
import { ERROR_MESSAGES, GENERIC_ERROR_MESSAGE, messageForError } from './errorMessages'

describe('에러 문구 (설계 9.5)', () => {
  it('모든 에러 코드에 문구가 있다', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_MESSAGES[code], code).toBeTruthy()
    }
  })

  it('코어 에러는 코드에 맞는 문구를 보여준다', () => {
    expect(messageForError(new ApiError('CONFLICT_PREVIEW_STALE', 'stale'))).toBe(
      '내용이 바뀌어서 다시 확인해 주세요.'
    )
  })

  it('내부 오류와 코어 에러가 아닌 예외는 일반 문구만 보여준다', () => {
    expect(messageForError(new ApiError('INTERNAL_ERROR', 'SQLITE_BUSY'))).toBe(
      GENERIC_ERROR_MESSAGE
    )
    expect(messageForError(new Error('network'))).toBe(GENERIC_ERROR_MESSAGE)
    expect(messageForError('oops')).toBe(GENERIC_ERROR_MESSAGE)
  })
})
