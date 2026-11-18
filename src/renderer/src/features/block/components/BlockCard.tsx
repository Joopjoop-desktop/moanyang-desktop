import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { BlockView } from '@shared/views'
import clsx from 'clsx'
import { BlockActionBar, CompleteCheckbox } from './BlockActionBar'
import type { BlockAction } from '@renderer/features/block/lib/blockActionRules'
import { BlockTitleLine } from './BlockTitleLine'
import type { DragData, DropData } from '@renderer/features/block/lib/dnd/dropRules'
import { ElementRow } from './ElementRow'
import { LabelPicker } from './LabelPicker'
import { ElementAdder } from './ElementAdder'

/**
 * 블록 카드. 삭제된 블록은 복구 말고는 보기만 한다.
 * - 카드 전체: 요소를 놓으면 맨 뒤로 이동, 블록을 놓으면 합치기
 * - 손잡이(⠿): 블록을 끌어 다른 블록에 합친다 (설계 9.6)
 * - 맨 위 체크박스: 블록 완료·완료 취소. 아래 버튼은 이대로 두기·삭제
 * draggable이 false면(캘린더 옆 카드 등) 끌기·놓기 없이 보기·편집만 한다.
 * handle이 false면 손잡이를 숨긴다(목록에서는 한 줄 항목을 잡고 블록을 끈다).
 * embedded가 true면 머리(체크박스·제목)와 카드 모양을 그리지 않고 내용만 그린다
 * (목록에서는 한 줄 항목이 머리이고 그 아래에 이어 붙는다).
 * onAction: 상태 버튼이 성공한 뒤 부른다.
 */
export function BlockCard({
  block,
  draggable = true,
  handle = true,
  embedded = false,
  onAction
}: {
  block: BlockView
  draggable?: boolean
  handle?: boolean
  embedded?: boolean
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
  const classNames = clsx(
    'flex flex-col',
    // 목록에서는 한 줄 항목(li)이 카드 모양을 그린다
    !embedded && 'rounded-lg bg-surface shadow-panel',
    // 다른 블록의 요소·블록을 이 카드에 놓으려 할 때
    targeted && 'outline-2 -outline-offset-2 outline-accent',
    // 끌고 있는 블록 원래 자리
    isDragging && 'opacity-40'
  )

  return (
    <article ref={setRefs} className={classNames}>
      {!embedded && (
        <header className="flex items-start gap-4 p-3 [&>input]:mt-0.25">
          {dndEnabled && handle && (
            <button
              type="button"
              className="inherit-font cursor-grab touch-none border-none bg-transparent px-0.5 py-0 leading-6 text-muted hover:text-text"
              aria-label="블록 끌기"
              {...listeners}
              {...attributes}
            >
              ⠿
            </button>
          )}
          {editable && <CompleteCheckbox block={block} onDone={onAction} />}
          <BlockTitleLine block={block} open />
        </header>
      )}

      <div className="flex flex-col items-start gap-3 px-12.5 py-2">
        <LabelPicker block={block} />

        <SortableContext
          items={block.elements.map((element) => element.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex w-full list-none flex-col gap-3 p-0">
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

        {editable && <ElementAdder block={block} />}
      </div>

      <footer className="mx-[0.8125rem] mt-1 mb-3 border-t border-border pt-3">
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
  if (!dragging || !target || target.kind === 'board' || target.kind === 'day') return false
  return target.blockId === blockId && dragging.blockId !== blockId
}
