import { useMutation } from '@tanstack/react-query'
import type { BlockView } from '@shared/views'
import { unwrap } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { useLabels } from '../../api/queries'
import { useToast } from '../toast/toastContext'
import styles from './LabelPicker.module.css'

type LabelChange = { kind: 'attach' | 'detach'; labelId: string }

/**
 * 블록 라벨: 붙은 라벨(× 로 떼기) + 붙이기 목록. (설계 7.4)
 * 같은 그룹 라벨을 붙이면 코어가 기존 라벨을 떼므로 화면은 따로 처리하지 않는다.
 * 휴지통 블록은 라벨을 바꿀 수 없어 보기만 한다.
 */
export function LabelPicker({ block }: { block: BlockView }): React.JSX.Element | null {
  const toast = useToast()
  const { data: labels } = useLabels()
  const editable = block.deletedAt === null
  const mutation = useMutation({
    mutationFn: ({ kind, labelId }: LabelChange) =>
      unwrap(
        kind === 'attach'
          ? window.api.label.attach({ blockId: block.id, labelId })
          : window.api.label.detach({ blockId: block.id, labelId })
      ),
    onError: (error) => toast.show({ message: messageForError(error) })
  })

  const attachedIds = new Set(block.labels.map((label) => label.id))
  const available = (labels ?? []).filter((label) => !attachedIds.has(label.id))
  if (!editable && block.labels.length === 0) return null

  return (
    <div className={styles.labels}>
      {block.labels.map((label) => (
        <span key={label.id} className={styles.chip}>
          {label.name}
          {editable && (
            <button
              type="button"
              className={styles.remove}
              aria-label={`${label.name} 떼기`}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ kind: 'detach', labelId: label.id })}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {editable && available.length > 0 && (
        <select
          className={styles.select}
          value=""
          disabled={mutation.isPending}
          onChange={(event) => mutation.mutate({ kind: 'attach', labelId: event.target.value })}
        >
          <option value="" disabled>
            + 라벨
          </option>
          {available.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
