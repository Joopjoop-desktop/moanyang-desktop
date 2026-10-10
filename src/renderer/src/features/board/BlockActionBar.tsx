import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { BlockView } from '@shared/views'
import { messageForError } from '../../api/errorMessages'
import { useToast } from '../toast/toastContext'
import { actionsFor, BLOCK_ACTIONS, runBlockAction, type BlockAction } from './blockActionRules'
import styles from './BlockActionBar.module.css'

type OnDone = (action: BlockAction) => void

/**
 * 블록 상태 동작 하나를 실행한다. 성공하면 알림을 띄우고, 되돌릴 수 있는 동작은 "되돌리기"를 붙인다.
 * 화면 갱신은 코어의 blocks:changed가 맡는다. (설계 9.5)
 * onDone: 성공한 뒤 부르는 곳에 알린다(예: 캘린더 옆 카드에서 삭제·완료하면 목록으로 돌아감).
 */
function useBlockAction(
  block: BlockView,
  onDone?: OnDone
): UseMutationResult<unknown, Error, BlockAction> {
  const toast = useToast()
  return useMutation({
    mutationFn: (action: BlockAction) => runBlockAction(action, block.id),
    onSuccess: (_result, action) => {
      const undo = BLOCK_ACTIONS[action].undo
      toast.show({
        message: BLOCK_ACTIONS[action].done,
        action: undo ? { label: '되돌리기', run: () => runBlockAction(undo, block.id) } : undefined
      })
      onDone?.(action)
    },
    onError: (error) => toast.show({ message: messageForError(error) })
  })
}

/** 카드 아래 버튼: 이대로 두기·삭제·복구 (완료는 맨 위 체크박스) */
export function BlockActionBar({
  block,
  onDone
}: {
  block: BlockView
  onDone?: OnDone
}): React.JSX.Element {
  const mutation = useBlockAction(block, onDone)

  return (
    <div className={styles.bar}>
      {actionsFor(block).map((action) => (
        <button
          key={action}
          type="button"
          className={action === 'delete' ? `${styles.button} ${styles.danger}` : styles.button}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(action)}
        >
          {BLOCK_ACTIONS[action].label}
        </button>
      ))}
    </div>
  )
}

/**
 * 카드 맨 위 완료 체크박스 (설계 9.6). 블록 단위 완료.
 * 체크하면 block:complete, 다시 누르면 block:reopen. 완료하면 "되돌리기" 알림이 뜬다.
 */
export function CompleteCheckbox({
  block,
  onDone
}: {
  block: BlockView
  onDone?: OnDone
}): React.JSX.Element {
  const mutation = useBlockAction(block, onDone)
  const completed = block.completedAt !== null

  return (
    <input
      type="checkbox"
      className={styles.check}
      checked={completed}
      disabled={mutation.isPending}
      aria-label={completed ? '완료 취소' : '완료'}
      onChange={() => mutation.mutate(completed ? 'reopen' : 'complete')}
    />
  )
}
