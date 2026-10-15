import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import type { BlockView } from '@shared/views'
import { messageForError } from '../../api/errorMessages'
import { useBlockList } from '../../api/queries'
import { describeElement } from '../../lib/display'
import { ConflictDialog, type PendingConflict } from '../board/conflict/ConflictDialog'
import { pickDropTarget } from '../board/dnd/collision'
import { performDrop } from '../board/dnd/dropActions'
import { resolveDrop, type DragData, type DropData } from '../board/dnd/dropRules'
import { useToast } from '../toast/toastContext'
import { blockTitle } from './fillRules'
import styles from './FillList.module.css'

type Props = { children: ReactNode }

/**
 * 오른쪽 목록의 드래그 영역. 달력과 같이 쓸 수 있게 목록 바깥(CalendarView)에 둔다. (설계 7.1, 9.6 표)
 * 놓으면 dropRules가 동작을 정하고 dropActions가 코어에 요청한다.
 * 같은 종류가 겹치면 충돌 선택 창을 띄운다. 화면 갱신은 blocks:changed가 맡는다.
 */
export function FillDnd({ children }: Props): React.JSX.Element {
  const needsInput = useBlockList('needsInput')
  const undated = useBlockList('undated')
  const toast = useToast()
  const [dragging, setDragging] = useState<DragData | null>(null)
  const [conflict, setConflict] = useState<PendingConflict | null>(null)
  // 6px 이상 움직여야 끌기 시작한다. 그보다 짧으면 클릭(펼치기, 값 편집, 버튼)으로 본다.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const allBlocks = [...(needsInput.data ?? []), ...(undated.data ?? [])]

  const onDragStart = (event: DragStartEvent): void => {
    setDragging((event.active.data.current as DragData | undefined) ?? null)
  }

  const onDragEnd = (event: DragEndEvent): void => {
    setDragging(null)
    const intent = resolveDrop(
      event.active.data.current as DragData | undefined,
      event.over?.data.current as DropData | undefined
    )
    if (!intent) return

    performDrop(intent)
      .then((outcome) => {
        if (outcome.kind === 'needsSelection') {
          setConflict({ intent: outcome.intent, preview: outcome.preview })
        } else if (outcome.autoDiscarded > 0) {
          toast.show({ message: `값이 같은 요소 ${outcome.autoDiscarded}개는 하나로 정리했어요.` })
        }
      })
      .catch((e: unknown) => toast.show({ message: messageForError(e) }))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pickDropTarget}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {dragging && <div className={styles.overlay}>{previewText(dragging, allBlocks)}</div>}
      </DragOverlay>
      {conflict && <ConflictDialog {...conflict} onClose={() => setConflict(null)} />}
    </DndContext>
  )
}

/** 끄는 동안 마우스를 따라다니는 글자 */
function previewText(dragging: DragData, blocks: readonly BlockView[]): string {
  const block = blocks.find((b) => b.id === dragging.blockId)
  if (!block) return ''
  if (dragging.kind === 'block') return `블록: ${blockTitle(block)}`
  const element = block.elements.find((e) => e.id === dragging.elementId)
  return element ? describeElement(element, new Date().getFullYear()).primary : ''
}
