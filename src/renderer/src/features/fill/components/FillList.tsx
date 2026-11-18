import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import { useState } from 'react'
import type { BlockListFilter, BlockView } from '@shared/views'
import { messageForError } from '@renderer/api/errorMessages'
import { useBlockList } from '@renderer/api/queries'
import chevronDown from '@renderer/assets/icons/chevron-down.svg'
import chevronUp from '@renderer/assets/icons/chevron-up.svg'
import { CompleteCheckbox } from '@renderer/features/block/components/BlockActionBar'
import { BlockCard } from '@renderer/features/block/components/BlockCard'
import { BlockTitleLine } from '@renderer/features/block/components/BlockTitleLine'
import type { DragData, DropData } from '@renderer/features/block/lib/dnd/dropRules'

type ListFilter = Extract<BlockListFilter, 'needsInput' | 'undated'>

/**
 * title이 없으면 제목 줄을 그리지 않는다: "채워 주세요 N"은 패널 맨 위 머리줄이 이미 보여 준다.
 * 비어 있는 목록은 아무것도 그리지 않는다(Figma Main2_1).
 */
const SECTIONS: readonly { filter: ListFilter; title: string | null }[] = [
  { filter: 'needsInput', title: null },
  { filter: 'undated', title: '날짜 없는 일' }
]

/** 목록 아래 빈 곳: 요소를 놓으면 새 블록으로 분리 (dropRules의 board) */
const SPLIT_DROP: DropData = { kind: 'board' }

/**
 * 오른쪽 목록 패널: 채워 주세요 / 날짜 없는 일. (설계 7.6, 9.6)
 * 항목은 한 줄 카드(체크박스 + 제목·빠진 것 칩·시각 + 펼침 화살표). 누르면 그 자리에서 카드가 펼쳐지고, 한 번에 하나만 펼친다.
 * 빠진 것을 채우면 blocks:changed로 다시 불러와 항목이 저절로 빠진다.
 *
 * 드래그(설계 7.1, 9.6): 드래그 영역(FillDnd)은 달력과 같이 쓰도록 바깥에 있다.
 * - 한 줄을 잡고 끌어 다른 항목에 놓으면 합치기, 달력 칸에 놓으면 날짜 넣기
 * - 펼친 카드의 요소를 다른 항목에 놓으면 이동, 목록 아래 빈 곳에 놓으면 분리, 카드 안에서는 순서 바꾸기
 */
export function FillList(): React.JSX.Element {
  const lists = {
    needsInput: useBlockList('needsInput'),
    undated: useBlockList('undated')
  }
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (blockId: string): void => setOpenId(openId === blockId ? null : blockId)

  return (
    <>
      {SECTIONS.map((section) => (
        <Section
          key={section.filter}
          {...section}
          query={lists[section.filter]}
          openId={openId}
          onToggle={toggle}
        />
      ))}
      <SplitZone />
    </>
  )
}

type SectionProps = {
  filter: ListFilter
  title: string | null
  query: { data: BlockView[] | undefined; error: Error | null }
  openId: string | null
  onToggle: (blockId: string) => void
}

function Section({
  filter,
  title,
  query: { data, error },
  openId,
  onToggle
}: SectionProps): React.JSX.Element | null {
  if (error) return <p className="text-[0.875rem] text-muted">{messageForError(error)}</p>
  if (!data) return <p className="text-[0.875rem] text-muted">불러오는 중…</p>
  if (data.length === 0) return null

  return (
    <section className="flex flex-col gap-4.25">
      {title && (
        <h3 className="flex items-center gap-2 text-[1.125rem] font-semibold text-text">
          {title}
          <span className="font-medium">{data.length}</span>
        </h3>
      )}
      <ul className="flex list-none flex-col gap-4.25 p-0">
        {data.map((block) => (
          <Row
            key={block.id}
            block={block}
            // 날짜 없는 일은 모두 "날짜 없음"이라 따로 표시하지 않는다
            showMissing={filter === 'needsInput'}
            open={openId === block.id}
            onToggle={() => onToggle(block.id)}
          />
        ))}
      </ul>
    </section>
  )
}

type RowProps = {
  block: BlockView
  showMissing: boolean
  open: boolean
  onToggle: () => void
}

/**
 * 한 줄 카드. 줄 전체가 놓는 곳(요소는 맨 뒤로 이동, 블록은 합치기)이고 줄을 잡고 블록을 끈다.
 * 6px 넘게 움직여야 끌기가 시작하므로 짧게 누르면 펼치기다. 체크박스는 끌기 영역 밖이다.
 * 펼치면 아래에 카드 내용이 이어 붙는다. 카드의 요소는 끌 수 있다.
 */
function Row({ block, showMissing, open, onToggle }: RowProps): React.JSX.Element {
  const dropData: DropData = { kind: 'blockArea', blockId: block.id }
  const dragData: DragData = { kind: 'block', blockId: block.id }
  const { setNodeRef: setDropRef } = useDroppable({ id: `row:${block.id}`, data: dropData })
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging
  } = useDraggable({ id: `row-drag:${block.id}`, data: dragData })
  const targeted = useIsDropTarget(block.id)

  // 카드 한 장: 한 줄 항목 + (펼치면) 내용
  const rowClass = clsx(
    'flex flex-col rounded-lg bg-surface shadow-panel',
    // 다른 블록의 요소나 블록을 이 카드 위로 끌고 있을 때
    targeted && 'outline-2 -outline-offset-2 outline-accent',
    isDragging && 'opacity-40'
  )

  return (
    <li className={rowClass}>
      <div ref={setDropRef} className="flex items-start gap-4 p-3 [&>input]:mt-0.25">
        <CompleteCheckbox block={block} />
        <button
          ref={setDragRef}
          type="button"
          className="inherit-font flex min-w-0 flex-1 cursor-pointer touch-none items-start gap-2 border-none bg-transparent p-0 text-left text-text"
          aria-expanded={open}
          title="끌어서 합치거나 날짜 칸에 놓기"
          onClick={onToggle}
          {...listeners}
          {...attributes}
        >
          <BlockTitleLine block={block} open={open} showMissing={showMissing} />
          <img className="mt-0.5 size-5 shrink-0" src={open ? chevronUp : chevronDown} alt="" />
        </button>
      </div>
      {open && <BlockCard block={block} handle={false} embedded />}
    </li>
  )
}

/** 요소를 놓으면 새 블록으로 나누는 곳. 요소가 둘 이상인 블록의 요소를 끌 때만 안내를 보여준다 */
function SplitZone(): React.JSX.Element {
  const { setNodeRef, isOver, active: drag } = useDroppable({ id: 'list-split', data: SPLIT_DROP })
  const dragging = drag?.data.current as DragData | undefined
  const active = dragging?.kind === 'element' && dragging.blockSize > 1

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex min-h-14 items-center justify-center rounded-lg border-2 border-dashed text-[0.875rem] text-accent',
        !active && 'border-transparent',
        active && !isOver && 'border-border',
        active && isOver && 'border-accent bg-accent-soft'
      )}
    >
      {active && '여기에 놓으면 새 블록으로 나눠요'}
    </div>
  )
}

/** 다른 블록의 요소나 블록을 이 줄(또는 펼친 카드) 위로 끌고 있는지 */
function useIsDropTarget(blockId: string): boolean {
  const { active, over } = useDndContext()
  const dragging = active?.data.current as DragData | undefined
  const target = over?.data.current as DropData | undefined
  if (!dragging || !target || target.kind === 'board' || target.kind === 'day') return false
  return target.blockId === blockId && dragging.blockId !== blockId
}
