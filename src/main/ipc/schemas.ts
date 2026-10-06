import { z } from 'zod'
import { ELEMENT_TYPES } from '@shared/model'
import { BLOCK_LIST_FILTERS } from '@shared/views'

/**
 * IPC 요청 검증 스키마. (설계 9.1)
 * UI가 보낸 값은 타입 검사를 거치지 않으므로 실행 중에 여기서 검사한다.
 * 모양은 @shared/ipc의 IpcContract와 같아야 하며, 다르면 handlers.ts에서 타입 에러가 난다.
 */

const id = z.string().min(1)
const index = z.number().int().min(0)

export const blockIdRequest = z.object({ blockId: id })
export const elementIdRequest = z.object({ elementId: id })
export const noRequest = z.undefined()

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

export const elementCreateRequest = z.object({ blockId: id, value: z.string() })

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
