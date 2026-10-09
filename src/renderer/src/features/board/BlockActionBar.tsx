import { useMutation } from '@tanstack/react-query'
import type { BlockView } from '@shared/views'
import { messageForError } from '../../api/errorMessages'
import { useToast } from '../toast/toastContext'
import { actionsFor, BLOCK_ACTIONS, runBlockAction, type BlockAction } from './blockActionRules'
import styles from './BlockActionBar.module.css'

/**
 * 이대로 두기·완료·삭제·복구 버튼. 성공하면 알림을 띄우고, 되돌릴 수 있는 동작은 "되돌리기"를 붙인다.
 * 화면 갱신은 코어의 blocks:changed가 맡는다. (설계 9.5)
 * onDone: 성공한 뒤 부르는 곳에 알린다(예: 캘린더 옆 카드에서 삭제·완료하면 목록으로 돌아감).
 */
export function BlockActionBar({
  block,
  onDone
}: {
  block: BlockView
  onDone?: (action: BlockAction) => void
}): React.JSX.Element {
  const toast = useToast()
  const mutation = useMutation({
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
