import type { TodayWindowState } from '@shared/today'
import type { Services } from '../services'
import type { ExtractionQueue } from '../services/extractionQueue'
import type { IpcHandlers } from './router'
import * as schemas from './schemas'

/** 창 다루기. Electron 창은 앱 시작 코드가 갖고 있어 함수로 받는다 (테스트는 가짜). */
export type WindowControls = {
  /** blockId가 있으면 스튜디오 오른쪽 패널에 그 블록 카드를 연다 */
  openStudio: (blockId?: string) => void
  /** 오늘 창 (설계 9.7). 바꾼 뒤의 상태를 돌려준다 */
  todayState: () => TodayWindowState
  setTodayOpacity: (opacity: number) => TodayWindowState
  setTodayCollapsed: (collapsed: boolean) => TodayWindowState
}

/**
 * 채널 → 서비스 호출 연결. (설계 9.3)
 * 여기서는 요청 모양을 서비스 인자로 바꾸기만 하고, 규칙은 서비스·도메인에 둔다.
 * capture:*는 원문을 메모리에 들고 있는 추출 큐로 보낸다.
 */
export function createIpcHandlers(
  services: Services,
  queue: ExtractionQueue,
  windows: WindowControls
): IpcHandlers {
  const { blocks, calendar, elements, labels, moves } = services

  return {
    'capture:submit': {
      schema: schemas.captureSubmitRequest,
      handle: ({ text, method }) => queue.submit(text, method)
    },
    'capture:retry': {
      schema: schemas.captureIdRequest,
      handle: ({ captureId }) => queue.retry(captureId)
    },
    'capture:listFailed': {
      schema: schemas.noRequest,
      handle: () => queue.listFailed()
    },
    'capture:dismiss': {
      schema: schemas.captureIdRequest,
      handle: ({ captureId }) => {
        queue.dismiss(captureId)
        return null
      }
    },
    'capture:unfinishedCount': {
      schema: schemas.noRequest,
      handle: () => ({ count: queue.unfinishedCount() })
    },

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
      handle: (input) => elements.create(input)
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
    },

    'calendar:list': {
      schema: schemas.calendarListRequest,
      handle: ({ from, to }) => calendar.list(from, to)
    },

    'window:openStudio': {
      schema: schemas.openStudioRequest,
      handle: (request) => {
        // 요청 없이 부르면 검증을 거친 값이 undefined다(계약 타입은 void)
        const { blockId } = (request ?? {}) as { blockId?: string }
        windows.openStudio(blockId)
        return null
      }
    },

    'today:getState': {
      schema: schemas.noRequest,
      handle: () => windows.todayState()
    },
    'today:setOpacity': {
      schema: schemas.todayOpacityRequest,
      handle: ({ opacity }) => windows.setTodayOpacity(opacity)
    },
    'today:setCollapsed': {
      schema: schemas.todayCollapsedRequest,
      handle: ({ collapsed }) => windows.setTodayCollapsed(collapsed)
    }
  }
}
