import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { ElementView } from '@shared/views'
import { unwrap } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { describeElement, ELEMENT_TYPE_LABELS } from '../../lib/display'
import { useToast } from '../toast/toastContext'
import { ElementEditor } from './ElementEditor'
import styles from './ElementRow.module.css'

type Props = {
  element: ElementView
  /** 올해가 아니면 날짜에 연도를 붙이기 위해 */
  currentYear: number
  /** 휴지통 블록은 보기만 한다 */
  editable: boolean
  /** 블록의 마지막 요소면 삭제가 블록 삭제가 된다 (설계 7.3) */
  isLast: boolean
}

/**
 * 요소 한 줄: 종류 이름 + 값 (+ 원래 표현, 확인 필요). (설계 9.6)
 * 값을 누르면 그 자리에서 고치고, 마우스를 올리면 삭제 ×가 보인다.
 */
export function ElementRow({ element, currentYear, editable, isLast }: Props): React.JSX.Element {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const display = describeElement(element, currentYear)
  const onError = (error: unknown): void => toast.show({ message: messageForError(error) })

  const confirm = useMutation({
    mutationFn: () => unwrap(window.api.element.confirm({ elementId: element.id })),
    onError
  })
  const remove = useMutation({
    mutationFn: () => unwrap(window.api.element.delete({ elementId: element.id })),
    onSuccess: () => {
      // 마지막 요소면 코어가 블록을 휴지통으로 보낸다. 요소 하나만 되살리는 기능은 없다.
      if (!isLast) return toast.show({ message: '요소를 삭제했어요.' })
      toast.show({
        message: '마지막 요소라 블록을 휴지통으로 옮겼어요.',
        action: {
          label: '되돌리기',
          run: () => unwrap(window.api.block.restore({ blockId: element.blockId }))
        }
      })
    },
    onError
  })

  return (
    <li className={styles.row}>
      <span className={styles.type}>{ELEMENT_TYPE_LABELS[element.type]}</span>
      {editing ? (
        <ElementEditor element={element} onClose={() => setEditing(false)} />
      ) : (
        <div className={styles.body}>
          <button
            type="button"
            className={element.type === 'task' ? `${styles.value} ${styles.task}` : styles.value}
            disabled={!editable}
            onClick={() => setEditing(true)}
          >
            {display.primary}
          </button>
          {display.secondary && <span className={styles.raw}>{display.secondary}</span>}
          {display.needsConfirm && (
            <span className={styles.confirm}>
              확인 필요
              {editable && (
                <button
                  type="button"
                  className={styles.confirmButton}
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate()}
                >
                  확인
                </button>
              )}
            </span>
          )}
          {editable && (
            <button
              type="button"
              className={styles.delete}
              aria-label={`${ELEMENT_TYPE_LABELS[element.type]} 삭제`}
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              ×
            </button>
          )}
        </div>
      )}
    </li>
  )
}
