import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { unwrap } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { memoValue } from '../../lib/elementEdit'
import editorStyles from './ElementEditor.module.css'
import styles from './MemoComposer.module.css'

/**
 * 블록 아래 "메모 추가". 모든 종류를 고르는 "+ 추가" 메뉴가 생기면 그것으로 바뀐다. (설계 7.7)
 * Ctrl+Enter로 저장, Esc로 취소.
 */
export function MemoComposer({ blockId }: { blockId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const close = (): void => {
    setOpen(false)
    setText('')
    setError(null)
  }
  const mutation = useMutation({
    mutationFn: (value: string) =>
      unwrap(window.api.element.create({ blockId, type: 'memo', value })),
    onSuccess: close,
    onError: (e) => setError(messageForError(e))
  })

  const save = (): void => {
    const value = memoValue(text)
    if (value === null) return setError('메모 내용을 적어 주세요.')
    mutation.mutate(value)
  }

  if (!open) {
    return (
      <button type="button" className={styles.add} onClick={() => setOpen(true)}>
        + 메모
      </button>
    )
  }

  return (
    <div
      className={editorStyles.editor}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
        if (event.key === 'Enter' && event.ctrlKey) {
          event.preventDefault()
          save()
        }
      }}
    >
      <textarea
        className={editorStyles.input}
        rows={2}
        placeholder="메모 (Ctrl+Enter로 저장)"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className={editorStyles.error}>{error}</p>}
      <div className={editorStyles.buttons}>
        <button
          type="button"
          className={editorStyles.primary}
          disabled={mutation.isPending}
          onClick={save}
        >
          추가
        </button>
        <button type="button" className={editorStyles.secondary} onClick={close}>
          취소
        </button>
      </div>
    </div>
  )
}
