import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { ConflictPreview, ConflictSelection } from '@shared/moves'
import type { ElementView } from '@shared/views'
import { messageForError } from '../../../api/errorMessages'
import { describeElement, ELEMENT_TYPE_LABELS } from '../../../lib/display'
import { useToast } from '../../toast/toastContext'
import type { MoveIntent } from '../dnd/dropRules'
import { confirmSelection } from './confirmSelection'
import styles from './ConflictDialog.module.css'
import { canConfirm, defaultSelection, isSelected, toggle } from './selection'

export type PendingConflict = { intent: MoveIntent; preview: ConflictPreview }

type Props = PendingConflict & { onClose: () => void }

/**
 * 충돌 선택 창. 같은 종류 요소가 겹치면 남길 것을 고른다. (설계 7.2, 9.6)
 * - 처음에는 대상 블록에 원래 있던 요소에 체크되어 있다.
 * - 묶음마다 하나 이상 골라야 확인할 수 있다. 취소하면 아무것도 바뀌지 않는다.
 * - 미리보기 이후 블록이 바뀌었으면 새 미리보기로 바꾸고 다시 확인을 받는다.
 */
export function ConflictDialog({ intent, preview: initial, onClose }: Props): React.JSX.Element {
  const toast = useToast()
  const [preview, setPreview] = useState(initial)
  const [selection, setSelection] = useState<ConflictSelection>(() => defaultSelection(initial))
  const [refreshed, setRefreshed] = useState(false)

  const mutation = useMutation({
    mutationFn: () => confirmSelection(intent, preview, selection),
    onSuccess: (outcome) => {
      if (outcome.kind === 'done') return onClose()
      setPreview(outcome.preview)
      setSelection(outcome.selection)
      setRefreshed(true)
    },
    onError: (error) => {
      toast.show({ message: messageForError(error) })
      onClose()
    }
  })

  const title = intent.kind === 'merge' ? '블록 합치기' : '요소 옮기기'

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        // 창이 열리면 창에 초점을 둬서 Esc로 바로 닫을 수 있게 한다
        tabIndex={-1}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !mutation.isPending) onClose()
        }}
      >
        <h2 id="conflict-title" className={styles.title}>
          {title}: 겹치는 요소를 골라 주세요
        </h2>
        <p className={styles.description}>남길 것을 체크하세요. 종류마다 하나 이상 남겨야 해요.</p>
        {refreshed && <p className={styles.notice}>내용이 바뀌어서 다시 확인해 주세요.</p>}
        {preview.autoDiscardedIds.length > 0 && (
          <p className={styles.description}>
            값이 같은 요소 {preview.autoDiscardedIds.length}개는 하나로 정리돼요.
          </p>
        )}

        {preview.groups.map((group) => (
          <fieldset key={group.type} className={styles.group}>
            <legend className={styles.legend}>{ELEMENT_TYPE_LABELS[group.type]}</legend>
            {group.existing.map((element) => (
              <Choice
                key={element.id}
                element={element}
                origin="원래 있던 것"
                checked={isSelected(selection, group.type, element.id)}
                onToggle={() => setSelection(toggle(selection, group.type, element.id))}
              />
            ))}
            {group.incoming.map((element) => (
              <Choice
                key={element.id}
                element={element}
                origin="옮겨오는 것"
                checked={isSelected(selection, group.type, element.id)}
                onToggle={() => setSelection(toggle(selection, group.type, element.id))}
              />
            ))}
          </fieldset>
        ))}

        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.secondary}
            disabled={mutation.isPending}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={mutation.isPending || !canConfirm(preview, selection)}
            onClick={() => mutation.mutate()}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

type ChoiceProps = {
  element: ElementView
  origin: string
  checked: boolean
  onToggle: () => void
}

function Choice({ element, origin, checked, onToggle }: ChoiceProps): React.JSX.Element {
  const display = describeElement(element, new Date().getFullYear())

  return (
    <label className={styles.choice}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className={styles.value}>{display.primary}</span>
      {display.secondary && <span className={styles.raw}>{display.secondary}</span>}
      <span className={styles.origin}>{origin}</span>
    </label>
  )
}
