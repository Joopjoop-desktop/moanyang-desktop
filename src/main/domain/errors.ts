import type { ErrorCode } from '@shared/errors'

/**
 * 사용자 입력이나 현재 데이터 상태 때문에 규칙을 지킬 수 없을 때 던진다.
 * IPC 계층이 code를 그대로 UI에 돌려준다.
 * (코드 실수로 생긴 잘못된 호출은 일반 Error를 던진다 → INTERNAL_ERROR)
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'DomainError'
  }
}
