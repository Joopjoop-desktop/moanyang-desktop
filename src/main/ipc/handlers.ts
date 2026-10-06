import type { Services } from '../services'
import type { IpcHandlers } from './router'
import * as schemas from './schemas'

/**
 * 채널 → 서비스 호출 연결. (설계 9.3)
 * 여기서는 요청 모양을 서비스 인자로 바꾸기만 하고, 규칙은 서비스·도메인에 둔다.
 */
export function createIpcHandlers(services: Services): IpcHandlers {
  const { blocks, elements, labels, moves } = services

  return {
    'block:list': {
      schema: schemas.blockListRequest,
      handle: ({ filter }) => blocks.list(filter)
    },
    'block:get': {
      schema: schemas.blockIdRequest,
      handle: ({ blockId }) => blocks.get(blockId)
    },
    'block:merge': {
      schema: schemas.blockMergeRequest,
      handle: (request) => moves.mergeBlocks(request)
    },
    'block:review': {
      schema: schemas.blockReviewRequest,
      handle: ({ blockId, reviewed }) => blocks.setReviewed(blockId, reviewed)
    },
    'block:complete': {
      schema: schemas.blockIdRequest,
      handle: ({ blockId }) => blocks.setCompleted(blockId, true)
    },
    'block:reopen': {
      schema: schemas.blockIdRequest,
      handle: ({ blockId }) => blocks.setCompleted(blockId, false)
    },
    'block:delete': {
      schema: schemas.blockIdRequest,
      handle: ({ blockId }) => {
        blocks.delete(blockId)
        return null
      }
    },
    'block:restore': {
      schema: schemas.blockIdRequest,
      handle: ({ blockId }) => blocks.restore(blockId)
    },

    'element:create': {
      schema: schemas.elementCreateRequest,
      handle: ({ blockId, value }) => elements.createMemo(blockId, value)
    },
    'element:update': {
      schema: schemas.elementUpdateRequest,
      handle: (request) =>
        elements.update(
          request.elementId,
          'value' in request
            ? { value: request.value }
            : { dateValue: request.dateValue, timeValue: request.timeValue }
        )
    },
    'element:confirm': {
      schema: schemas.elementIdRequest,
      handle: ({ elementId }) => elements.confirm(elementId)
    },
    'element:delete': {
      schema: schemas.elementIdRequest,
      handle: ({ elementId }) => {
        elements.delete(elementId)
        return null
      }
    },
    'element:move': {
      schema: schemas.elementMoveRequest,
      handle: ({ elementId, to }) => {
        switch (to.kind) {
          case 'reorder':
            return moves.reorderElement(elementId, to.index)
          case 'block':
            return moves.moveElementToBlock({
              elementId,
              targetBlockId: to.blockId,
              insertIndex: to.index,
              resolution: to.resolution
            })
          case 'new':
            return moves.splitElement(elementId)
        }
      }
    },
    'element:checkConflict': {
      schema: schemas.conflictCheckRequest,
      handle: (request) =>
        request.kind === 'element'
          ? moves.previewMoveElement(request.elementId, request.targetBlockId)
          : moves.previewMergeBlocks(request.sourceBlockId, request.targetBlockId)
    },

    'label:list': {
      schema: schemas.noRequest,
      handle: () => labels.list()
    },
    'label:attach': {
      schema: schemas.labelLinkRequest,
      handle: ({ blockId, labelId }) => labels.attach(blockId, labelId)
    },
    'label:detach': {
      schema: schemas.labelLinkRequest,
      handle: ({ blockId, labelId }) => labels.detach(blockId, labelId)
    }
  }
}
