import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { UpdateElementInput } from '@shared/elements'
import type { ElementType } from '@shared/model'
import type { BlockView } from '@shared/views'
import { unwrap } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { ELEMENT_TYPE_LABELS } from '../../lib/display'
import { emptyDraft, toCreate, type ElementDraft } from '../../lib/elementEdit'
import styles from './ElementAdder.module.css'
import editorStyles from './ElementEditor.module.css'

type State =
  | { step: 'closed' }
  | { step: 'menu' }
  | { step: 'editing'; type: ElementType; draft: ElementDraft }

/**
 * 블록 아래 "+ 추가". (설계 7.7, 9.6)
 * 누르면 지금 추가할 수 있는 종류만 메뉴로 보여준다(코어가 BlockView.addable로 알려줌).
 * 고르면 빈 편집칸이 열린다. 저장하면 코어가 정해진 순서 자리에 넣는다.
 * Enter(여러 줄 칸은 Ctrl+Enter)로 저장, Esc로 취소. 빈 채로 저장하면 만들지 않고 닫는다.
 */
export function ElementAdder({ block }: { block: BlockView }): React.JSX.Element | null {
  const [state, setState] = useState<State>({ step: 'closed' })
  const [error, setError] = useState<string | null>(null)

  const close = (): void => {
    setState({ step: 'closed' })
    setError(null)
  }
  const mutation = useMutation({
    mutationFn: ({ type, input }: { type: ElementType; input: UpdateElementInput }) =>
      unwrap(window.api.element.create({ blockId: block.id, type, ...input })),
    onSuccess: close,
    onError: (e) => setError(messageForError(e))
  })

  if (block.addable.length === 0) return null

  if (state.step === 'closed') {
    return (
      <button type="button" className={styles.add} onClick={() => setState({ step: 'menu' })}>
        + 추가
      </button>
    )
  }

  if (state.step === 'menu') {
    return (
      <div className={styles.menu} onKeyDown={(e) => e.key === 'Escape' && close()}>
        {block.addable.map((type) => (
          <button
            key={type}
            type="button"
            className={styles.choice}
            onClick={() => setState({ step: 'editing', type, draft: emptyDraft(type) })}
          >
            {ELEMENT_TYPE_LABELS[type]}
          </button>
        ))}
        <button type="button" className={styles.cancel} onClick={close}>
          취소
        </button>
      </div>
    )
  }

  const { type, draft } = state
  const setDraft = (next: ElementDraft): void => setState({ ...state, draft: next })

  const save = (): void => {
    const result = toCreate(draft)
    if (result.kind === 'empty') return close()
    if (result.kind === 'invalid') return setError(result.message)
    mutation.mutate({ type, input: result.input })
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') close()
    const multiline = event.target instanceof HTMLTextAreaElement
    if (event.key === 'Enter' && (!multiline || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  }

  return (
    <div className={styles.editing} onKeyDown={onKeyDown}>
      <span className={styles.type}>{ELEMENT_TYPE_LABELS[type]}</span>
      <div className={editorStyles.editor}>
        {draft.kind === 'date' ? (
          <div className={editorStyles.dateRow}>
            <input
              type="date"
              className={editorStyles.input}
              value={draft.dateValue}
              autoFocus
              onChange={(e) => setDraft({ ...draft, dateValue: e.target.value })}
            />
            <input
              type="time"
              className={editorStyles.input}
              value={draft.timeValue}
              onChange={(e) => setDraft({ ...draft, timeValue: e.target.value })}
            />
          </div>
        ) : type === 'detail' || type === 'memo' ? (
          <textarea
            className={editorStyles.input}
            rows={3}
            value={draft.value}
            autoFocus
            onChange={(e) => setDraft({ kind: 'text', value: e.target.value })}
          />
        ) : (
          <input
            className={editorStyles.input}
            value={draft.value}
            autoFocus
            onChange={(e) => setDraft({ kind: 'text', value: e.target.value })}
          />
        )}
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
    </div>
  )
}
