/**
 * 날짜 요소 값 검사. 사용자 수정(elementValues)과 추출 결과 검증(8.5)이 함께 쓴다.
 * dateValue·timeValue는 달력상의 값이므로 UTC로 바꾸지 않는다. (설계 6.4)
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** YYYY-MM-DD 형식이고 달력에 실제로 있는 날인지 (2026-02-30, 2026-13-01은 false) */
export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  // 2026-02-30처럼 형식만 맞고 없는 날짜는 다음 달로 넘어가므로 문자열이 달라진다
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** HH:mm, 00:00 ~ 23:59 */
export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value)
}
