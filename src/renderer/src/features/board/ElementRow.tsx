import { useDndContext } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { ElementView } from '@shared/views'
import { unwrap } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { describeElement, ELEMENT_TYPE_LABELS } from '../../lib/display'
import { useToast } from '../toast/toastContext'
import type { DragData, ElementDnd } from './dnd/dropRules'
import { ElementEditor } from './ElementEditor'
import styles from './ElementRow.module.css'

type Props = {
  element: ElementView
  /** 블록 안 위치 */
  index: number
  /** 블록의 요소 수. 1이면 삭제가 블록 삭제가 된다 (설계 7.3) */
  blockSize: number
  /** 올해가 아니면 날짜에 연도를 붙이기 위해 */
  currentYear: number
  /** 삭제된 블록은 보기만 한다 */
  editable: boolean
  /** false면 끌 수 없다 (캘린더 옆 카드 등) */
  draggable?: boolean
}

/**
 * 요소 한 줄: 종류 이름 + 값 (+ 원래 표현, 확인 필요). (설계 9.6)
 * 값을 누르면 그 자리에서 고치고, 마우스를 올리면 삭제 ×가 보인다.
 * 줄을 끌어 순서를 바꾸거나 다른 블록·빈 곳에 놓는다. 고치는 중에는 끌 수 없다.
 */
export function ElementRow({
  element,
  index,
  blockSize,
  currentYear,
  editable,
  draggable = true
}: Props): React.JSX.Element {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const display = describeElement(element, currentYear)
  const isLast = blockSize === 1
  const dndData: ElementDnd = {
    kind: 'element',
    elementId: element.id,
    blockId: element.blockId,
    index,
    blockSize
  }
  const { setNodeRef, listeners, transform, transition, isDragging, isOver } = useSortable({
    id: element.id,
    data: dndData,
    disabled: !editable || !draggable || editing
  })
  const insertBefore = useInsertMarker(isOver, element.blockId)
  const onError = (error: unknown): void => toast.show({ message: messageForError(error) })

  const confirm = useMutation({
    mutationFn: () => unwrap(window.api.element.confirm({ elementId: element.id })),
    onError
  })
  const remove = useMutation({
    mutationFn: () => unwrap(window.api.element.delete({ elementId: element.id })),
    onSuccess: () => {
      // 마지막 요소면 코어가 블록을 삭제한다. 요소 하나만 되살리는 기능은 없다.
      if (!isLast) return toast.show({ message: '요소를 삭제했어요.' })
      toast.show({
        message: '마지막 요소라 블록을 삭제했어요.',
        action: {
          label: '되돌리기',
          run: () => unwrap(window.api.block.restore({ blockId: element.blockId }))
        }
      })
    },
    onError
  })

  const classNames = [
    styles.row,
    editable && draggable && !editing ? styles.draggable : '',
    isDragging ? styles.dragging : '',
    insertBefore ? styles.insertBefore : ''
  ].join(' ')

  return (
    <li
      ref={setNodeRef}
      className={classNames}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...listeners}
    >
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

/**
 * 다른 블록의 요소를 이 줄 위로 끌고 있으면 "이 줄 앞에 끼워진다"는 선을 보여준다.
 * 같은 블록 안 순서 바꾸기는 줄이 직접 움직여 보이므로 선을 그리지 않는다.
 */
function useInsertMarker(isOver: boolean, blockId: string): boolean {
  const { active } = useDndContext()
  const dragging = active?.data.current as DragData | undefined
  return isOver && dragging?.kind === 'element' && dragging.blockId !== blockId
}
