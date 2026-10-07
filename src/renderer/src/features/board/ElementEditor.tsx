import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { IpcRequest } from '@shared/ipc'
import type { ElementView } from '@shared/views'
import { unwrap } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { draftFrom, toUpdate, type ElementDraft } from '../../lib/elementEdit'
import styles from './ElementEditor.module.css'

type Props = {
  element: ElementView
  onClose: () => void
}

/**
 * 요소를 그 자리에서 고치는 칸. (설계 9.6)
 * Enter(여러 줄 칸은 Ctrl+Enter)로 저장, Esc로 취소. 다른 곳을 눌러도 저장하지 않는다.
 */
export function ElementEditor({ element, onClose }: Props): React.JSX.Element {
  const [draft, setDraft] = useState<ElementDraft>(() => draftFrom(element))
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (input: IpcRequest<'element:update'>) => unwrap(window.api.element.update(input)),
    onSuccess: onClose,
    onError: (e) => setError(messageForError(e))
  })

  const save = (): void => {
    const result = toUpdate(element, draft)
    if (result.kind === 'unchanged') return onClose()
    if (result.kind === 'invalid') return setError(result.message)
    mutation.mutate({ elementId: element.id, ...result.input })
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') onClose()
    const multiline = event.target instanceof HTMLTextAreaElement
    if (event.key === 'Enter' && (!multiline || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  }

  return (
    <div className={styles.editor} onKeyDown={onKeyDown}>
      {draft.kind === 'date' ? (
        <div className={styles.dateRow}>
          <input
            type="date"
            className={styles.input}
            value={draft.dateValue}
            autoFocus
            onChange={(e) => setDraft({ ...draft, dateValue: e.target.value })}
          />
          <input
            type="time"
            className={styles.input}
            value={draft.timeValue}
            onChange={(e) => setDraft({ ...draft, timeValue: e.target.value })}
          />
        </div>
      ) : element.type === 'detail' || element.type === 'memo' ? (
        <textarea
          className={styles.input}
          rows={3}
          value={draft.value}
          autoFocus
          onChange={(e) => setDraft({ kind: 'text', value: e.target.value })}
        />
      ) : (
        <input
          className={styles.input}
          value={draft.value}
          autoFocus
          onChange={(e) => setDraft({ kind: 'text', value: e.target.value })}
        />
      )}
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.primary}
          disabled={mutation.isPending}
          onClick={save}
        >
          저장
        </button>
        <button type="button" className={styles.secondary} onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  )
}
