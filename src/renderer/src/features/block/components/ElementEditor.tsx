import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { IpcRequest } from '@shared/ipc'
import type { ElementView } from '@shared/views'
import { unwrap } from '@renderer/api/client'
import { messageForError } from '@renderer/api/errorMessages'
import { draftFrom, toUpdate, type ElementDraft } from '@renderer/lib/elementEdit'
import { editorClasses } from './elementEditorClasses'

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
    <div className={editorClasses.editor} onKeyDown={onKeyDown}>
      {draft.kind === 'date' ? (
        <div className={editorClasses.dateRow}>
          <input
            type="date"
            className={editorClasses.input}
            value={draft.dateValue}
            autoFocus
            onChange={(e) => setDraft({ ...draft, dateValue: e.target.value })}
          />
          <input
            type="time"
            className={editorClasses.input}
            value={draft.timeValue}
            onChange={(e) => setDraft({ ...draft, timeValue: e.target.value })}
          />
        </div>
      ) : element.type === 'detail' || element.type === 'memo' ? (
        <textarea
          className={editorClasses.input}
          rows={3}
          value={draft.value}
          autoFocus
          onChange={(e) => setDraft({ kind: 'text', value: e.target.value })}
        />
      ) : (
        <input
          className={editorClasses.input}
          value={draft.value}
          autoFocus
          onChange={(e) => setDraft({ kind: 'text', value: e.target.value })}
        />
      )}
      {error && <p className={editorClasses.error}>{error}</p>}
      <div className={editorClasses.buttons}>
        <button
          type="button"
          className={editorClasses.primary}
          disabled={mutation.isPending}
          onClick={save}
        >
          저장
        </button>
        <button type="button" className={editorClasses.secondary} onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  )
}
