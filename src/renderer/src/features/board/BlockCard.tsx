import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { BlockView } from '@shared/views'
import { formatTimestamp } from '../../lib/display'
import { BlockActionBar } from './BlockActionBar'
import type { BlockAction } from './blockActionRules'
import styles from './BlockCard.module.css'
import type { DragData, DropData } from './dnd/dropRules'
import { ElementRow } from './ElementRow'
import { LabelPicker } from './LabelPicker'
import { MemoComposer } from './MemoComposer'

/**
 * 블록 카드. 삭제된 블록은 복구 말고는 보기만 한다.
 * - 카드 전체: 요소를 놓으면 맨 뒤로 이동, 블록을 놓으면 합치기
 * - 손잡이(⠿): 블록을 끌어 다른 블록에 합친다 (설계 9.6)
 * draggable이 false면(캘린더 옆 카드 등) 끌기·놓기 없이 보기·편집만 한다.
 * handle이 false면 손잡이를 숨긴다(목록에서는 한 줄 항목의 손잡이로 블록을 끈다).
 * onAction: 상태 버튼이 성공한 뒤 부른다.
 */
export function BlockCard({
  block,
  draggable = true,
  handle = true,
  onAction
}: {
  block: BlockView
  draggable?: boolean
  handle?: boolean
  onAction?: (action: BlockAction) => void
}): React.JSX.Element {
  const currentYear = new Date().getFullYear()
  const editable = block.deletedAt === null
  const dndEnabled = editable && draggable
  const dropData: DropData = { kind: 'blockArea', blockId: block.id }
  const dragData: DragData = { kind: 'block', blockId: block.id }
  const { setNodeRef: setDropRef } = useDroppable({
    id: `block-area:${block.id}`,
    data: dropData,
    disabled: !dndEnabled
  })
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging
  } = useDraggable({
    id: `block:${block.id}`,
    data: dragData,
    disabled: !dndEnabled || !handle
  })
  const targeted = useIsDropTarget(block.id)

  // 카드 하나가 놓는 곳이면서 끄는 대상이다
  const setRefs = (node: HTMLElement | null): void => {
    setDropRef(node)
    setDragRef(node)
  }
  const classNames = [
    styles.card,
    targeted ? styles.target : '',
    isDragging ? styles.dragging : ''
  ].join(' ')

  return (
    <article ref={setRefs} className={classNames}>
      <header className={styles.header}>
        {dndEnabled && handle && (
          <button
            type="button"
            className={styles.handle}
            aria-label="블록 끌기"
            {...listeners}
            {...attributes}
          >
            ⠿
          </button>
        )}
        <span className={styles.meta}>{headerText(block)}</span>
        {block.completedAt && <span className={styles.done}>완료</span>}
      </header>

      <LabelPicker block={block} />

      <SortableContext
        items={block.elements.map((element) => element.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={styles.elements}>
          {block.elements.map((element, index) => (
            <ElementRow
              key={element.id}
              element={element}
              index={index}
              blockSize={block.elements.length}
              currentYear={currentYear}
              editable={editable}
              draggable={dndEnabled}
            />
          ))}
        </ul>
      </SortableContext>

      {editable && <MemoComposer blockId={block.id} />}

      <footer className={styles.footer}>
        <BlockActionBar block={block} onDone={onAction} />
      </footer>
    </article>
  )
}

/** 다른 블록의 요소나 블록을 이 카드 위로 끌고 있는지 (카드 테두리 강조용) */
function useIsDropTarget(blockId: string): boolean {
  const { active, over } = useDndContext()
  const dragging = active?.data.current as DragData | undefined
  const target = over?.data.current as DropData | undefined
  if (!dragging || !target || target.kind === 'board') return false
  return target.blockId === blockId && dragging.blockId !== blockId
}

function headerText(block: BlockView): string {
  if (block.deletedAt) return `${formatTimestamp(block.deletedAt)} 삭제`
  if (block.completedAt) return `${formatTimestamp(block.completedAt)} 완료`
  return formatTimestamp(block.createdAt)
}
