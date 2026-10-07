import type { ErrorCode } from '@shared/errors'
import type { IpcResult } from '@shared/ipc'

/** 코어가 돌려준 실패 응답. 화면은 code로 문구를 정한다. (설계 9.2) */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * window.api 호출 결과를 풀어 데이터만 돌려준다. 실패면 ApiError를 던진다. (설계 9.5)
 * 예: const blocks = await unwrap(window.api.block.list({ filter: 'inbox' }))
 */
export async function unwrap<T>(pending: Promise<IpcResult<T>>): Promise<T> {
  const result = await pending
  if (!result.ok) throw new ApiError(result.error.code, result.error.message)
  return result.data
}
