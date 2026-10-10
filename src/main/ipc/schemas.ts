import { z } from 'zod'
import { CAPTURE_TEXT_MAX_LENGTH } from '@shared/captures'
import { CAPTURE_METHODS, ELEMENT_TYPES } from '@shared/model'
import { TODAY_OPACITY_MAX, TODAY_OPACITY_MIN } from '@shared/today'
import { BLOCK_LIST_FILTERS } from '@shared/views'
import { isValidDate } from '../domain/calendarValues'

/**
 * IPC 요청 검증 스키마. (설계 9.1)
 * UI가 보낸 값은 타입 검사를 거치지 않으므로 실행 중에 여기서 검사한다.
 * 모양은 @shared/ipc의 IpcContract와 같아야 하며, 다르면 handlers.ts에서 타입 에러가 난다.
 */

const id = z.string().min(1)
const index = z.number().int().min(0)

/** 원문은 고치지 않고 그대로 넘긴다. 공백뿐이거나 너무 길면 거절 (설계 8.2) */
export const captureSubmitRequest = z.object({
  text: z
    .string()
    .max(CAPTURE_TEXT_MAX_LENGTH)
    .refine((text) => text.trim() !== '', '빈 텍스트는 먹일 수 없습니다'),
  method: z.enum(CAPTURE_METHODS)
})
export const captureIdRequest = z.object({ captureId: id })

export const blockIdRequest = z.object({ blockId: id })
export const elementIdRequest = z.object({ elementId: id })
export const noRequest = z.undefined()

/** 스튜디오 열기: 요청 없이, 또는 열어 둘 블록과 함께 (설계 9.7) */
export const openStudioRequest = z.object({ blockId: id.optional() }).optional()

export const blockListRequest = z.object({ filter: z.enum(BLOCK_LIST_FILTERS) })

export const blockReviewRequest = z.object({ blockId: id, reviewed: z.boolean() })

const conflictResolution = z.object({
  selection: z.partialRecord(z.enum(ELEMENT_TYPES), z.array(id)),
  previewed: z.object({ sourceUpdatedAt: z.string(), targetUpdatedAt: z.string() })
})

export const blockMergeRequest = z.object({
  sourceBlockId: id,
  targetBlockId: id,
  resolution: conflictResolution.optional()
})

/** 종류 + 값. 값 모양은 수정과 같고, 종류와 맞는지는 도메인이 검사한다 (설계 7.7) */
export const elementCreateRequest = z.union([
  z.object({ blockId: id, type: z.enum(ELEMENT_TYPES), value: z.string() }),
  z.object({
    blockId: id,
    type: z.enum(ELEMENT_TYPES),
    dateValue: z.string(),
    timeValue: z.string().nullable()
  })
])

/** 텍스트 요소는 value, 날짜 요소는 dateValue + timeValue. 형식 상세 검사는 도메인이 한다. */
export const elementUpdateRequest = z.union([
  z.object({ elementId: id, value: z.string() }),
  z.object({ elementId: id, dateValue: z.string(), timeValue: z.string().nullable() })
])

export const elementMoveRequest = z.object({
  elementId: id,
  to: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('reorder'), index }),
    z.object({
      kind: z.literal('block'),
      blockId: id,
      index: index.optional(),
      resolution: conflictResolution.optional()
    }),
    z.object({ kind: z.literal('new') })
  ])
})

export const conflictCheckRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('element'), elementId: id, targetBlockId: id }),
  z.object({ kind: z.literal('block'), sourceBlockId: id, targetBlockId: id })
])

export const labelLinkRequest = z.object({ blockId: id, labelId: id })

/** 오늘 창 투명도(%): 30~100 정수 (설계 9.7) */
export const todayOpacityRequest = z.object({
  opacity: z.number().int().min(TODAY_OPACITY_MIN).max(TODAY_OPACITY_MAX)
})
export const todayCollapsedRequest = z.object({ collapsed: z.boolean() })

/** 달력에 있는 날짜(YYYY-MM-DD)만. 2026-02-30 같은 없는 날짜는 거절 */
const calendarDate = z.string().refine(isValidDate, '달력에 있는 YYYY-MM-DD 날짜여야 합니다')

/** 달력 조회 기간. from이 to보다 늦으면 거절 (설계 7.5) */
export const calendarListRequest = z
  .object({ from: calendarDate, to: calendarDate })
  .refine(({ from, to }) => from <= to, { message: 'from이 to보다 늦습니다', path: ['from'] })
