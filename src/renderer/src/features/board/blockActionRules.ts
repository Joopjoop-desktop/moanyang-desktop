import type { BlockView } from '@shared/views'
import { unwrap } from '../../api/client'

/** 블록 카드의 상태 버튼 (설계 7.4, 9.6) */
export type BlockAction = 'review' | 'unreview' | 'complete' | 'reopen' | 'delete' | 'restore'

export const BLOCK_ACTIONS: Record<
  BlockAction,
  {
    /** 버튼 이름 */
    label: string
    /** 성공 알림 */
    done: string
    /** 알림의 "되돌리기"가 실행할 동작. 없으면 되돌리기 버튼 없음 */
    undo: BlockAction | null
  }
> = {
  review: { label: '검토 완료', done: '검토를 마쳤어요.', undo: 'unreview' },
  unreview: { label: '검토 취소', done: '검토함으로 돌려놨어요.', undo: null },
  complete: { label: '완료', done: '완료했어요.', undo: 'reopen' },
  reopen: { label: '완료 취소', done: '완료를 취소했어요.', undo: null },
  delete: { label: '삭제', done: '휴지통으로 옮겼어요.', undo: 'restore' },
  restore: { label: '복구', done: '복구했어요.', undo: null }
}

/** 블록 상태에 맞는 버튼. 휴지통 블록은 복구만 할 수 있다. */
export function actionsFor(block: BlockView): BlockAction[] {
  if (block.deletedAt) return ['restore']
  return [
    block.reviewedAt ? 'unreview' : 'review',
    block.completedAt ? 'reopen' : 'complete',
    'delete'
  ]
}

/** 동작을 코어에 요청한다. 실패하면 ApiError */
export function runBlockAction(action: BlockAction, blockId: string): Promise<unknown> {
  switch (action) {
    case 'review':
      return unwrap(window.api.block.review({ blockId, reviewed: true }))
    case 'unreview':
      return unwrap(window.api.block.review({ blockId, reviewed: false }))
    case 'complete':
      return unwrap(window.api.block.complete({ blockId }))
    case 'reopen':
      return unwrap(window.api.block.reopen({ blockId }))
    case 'delete':
      return unwrap(window.api.block.delete({ blockId }))
    case 'restore':
      return unwrap(window.api.block.restore({ blockId }))
  }
}
