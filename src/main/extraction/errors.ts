/**
 * 추출 실패. 큐가 retryable로 자동 재시도 여부를 정한다. (설계 8.7)
 * - retryable: true → 네트워크 오류 등, 간격을 두고 다시 시도
 * - retryable: false → 출력 형식 오류 등, 바로 failed
 */
export class ExtractError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'ExtractError'
  }
}
