import { z } from 'zod'
import { isValidDate, isValidTime } from '../domain/calendarValues'
import { ExtractError } from './errors'
import type { DateValue, ExtractItem, ExtractOutput } from './types'

/** 검사·정리를 마친 결과. items가 비어 있으면 할 일 없음 (설계 8.5) */
export type ExtractedItem = ExtractItem

const dateValueSchema = z.object({
  date: z.string().nullable(),
  time: z.string().nullable(),
  rawText: z.string().nullable(),
  ambiguous: z.boolean()
})

const outputSchema: z.ZodType<ExtractOutput> = z.object({
  schemaVersion: z.literal(1),
  notTask: z.boolean(),
  items: z.array(
    z.object({
      task: z.string().nullable(),
      detail: z.string().nullable(),
      requester: z.string().nullable(),
      startDate: dateValueSchema.nullable(),
      dueDate: dateValueSchema.nullable()
    })
  )
})

/**
 * 추출기 출력을 검사하고 저장할 수 있는 값으로 정리한다. (설계 8.5)
 * - 구조가 틀리면 재시도할 수 없는 ExtractError
 * - 글자는 앞뒤 공백 제거, 빈 문자열은 null
 * - 없는 날짜·틀린 시간은 비우고 ambiguous를 켠다 (먹이 전체를 실패로 만들지 않음)
 * - 내용이 모두 빈 item은 버린다. notTask이면 빈 배열
 */
export function parseExtractOutput(raw: unknown): ExtractedItem[] {
  const parsed = outputSchema.safeParse(raw)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(출력)'}: ${issue.message}`)
      .join('; ')
    throw new ExtractError(`추출 결과 형식이 틀립니다: ${detail}`, false)
  }
  if (parsed.data.notTask) return []

  return parsed.data.items.map(normalizeItem).filter((item) => !isEmptyItem(item))
}

function normalizeItem(item: ExtractItem): ExtractedItem {
  return {
    task: cleanText(item.task),
    detail: cleanText(item.detail),
    requester: cleanText(item.requester),
    startDate: normalizeDate(item.startDate),
    dueDate: normalizeDate(item.dueDate)
  }
}

function normalizeDate(value: DateValue | null): DateValue | null {
  if (value === null) return null

  let ambiguous = value.ambiguous
  let rawText = cleanText(value.rawText)
  let date = cleanText(value.date)
  let time = cleanText(value.time)

  if (date !== null && !isValidDate(date)) {
    // 원래 표현이 없으면 틀린 값 자체를 남겨 사용자가 무엇이 애매했는지 볼 수 있게 한다
    rawText ??= date
    date = null
    ambiguous = true
  }
  if (time !== null && !isValidTime(time)) {
    time = null
    ambiguous = true
  }
  // 날짜 없이 시간만 있으면 어느 날인지 알 수 없으므로 버린다
  if (date === null) time = null

  if (date === null && rawText === null) return null
  // 날짜를 정하지 못하고 표현만 있으면(예: "다음주쯤") 사용자가 확인해야 한다 (설계 8.6)
  if (date === null) ambiguous = true

  return { date, time, rawText, ambiguous }
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isEmptyItem(item: ExtractedItem): boolean {
  return (
    item.task === null &&
    item.detail === null &&
    item.requester === null &&
    item.startDate === null &&
    item.dueDate === null
  )
}
