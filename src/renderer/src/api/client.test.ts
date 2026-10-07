import { describe, expect, it } from 'vitest'
import { ApiError, unwrap } from './client'

describe('unwrap', () => {
  it('성공하면 데이터만 돌려준다', async () => {
    expect(await unwrap(Promise.resolve({ ok: true as const, data: [1, 2] }))).toEqual([1, 2])
  })

  it('실패하면 에러 코드를 담은 ApiError를 던진다', async () => {
    const error = await unwrap(
      Promise.resolve({
        ok: false as const,
        error: { code: 'BLOCK_NOT_FOUND' as const, message: '블록이 없습니다: b1' }
      })
    ).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'BLOCK_NOT_FOUND', message: '블록이 없습니다: b1' })
  })
})
