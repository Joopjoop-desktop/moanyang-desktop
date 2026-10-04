/**
 * 현재 시각을 저장 형식(ISO 8601, UTC, 밀리초 포함)으로 반환한다.
 * DB에 저장하는 시각 문자열은 반드시 이 함수로만 만든다. (설계 6.4)
 */
export function nowIso(): string {
  return new Date().toISOString()
}
