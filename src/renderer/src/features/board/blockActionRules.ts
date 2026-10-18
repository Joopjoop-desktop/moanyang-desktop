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
  review: { label: '이대로 두기', done: '날짜 없는 일로 옮겼어요.', undo: 'unreview' },
  unreview: { label: '이대로 두기 취소', done: '채워 주세요로 돌려놨어요.', undo: null },
  complete: { label: '완료', done: '완료했어요.', undo: 'reopen' },
  reopen: { label: '완료 취소', done: '완료를 취소했어요.', undo: null },
  delete: { label: '삭제하기', done: '삭제했어요.', undo: 'restore' },
  restore: { label: '복구', done: '복구했어요.', undo: null }
}

/**
 * 카드 아래 버튼. (설계 7.6, 9.6)
 * "이대로 두기"는 할 일이 있고 날짜만 빠졌으며 아직 안 했을 때만. 취소는 되돌리기 알림으로만 한다.
 * 완료·완료 취소는 버튼이 아니라 카드 맨 위 체크박스로 한다(10단계).
 * 삭제된 블록은 복구만 할 수 있다(화면에는 나오지 않고 되돌리기 알림으로만 복구).
 */
export function actionsFor(block: BlockView): BlockAction[] {
  if (block.deletedAt) return ['restore']
  return [...(canKeepUndated(block) ? (['review'] as const) : []), 'delete']
}

function canKeepUndated(block: BlockView): boolean {
  return (
    block.reviewedAt === null && block.missing.includes('date') && !block.missing.includes('task')
  )
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
