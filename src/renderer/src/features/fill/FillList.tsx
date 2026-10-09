import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { useState } from 'react'
import type { BlockListFilter, BlockView } from '@shared/views'
import { messageForError } from '../../api/errorMessages'
import { useBlockList } from '../../api/queries'
import { describeElement } from '../../lib/display'
import { BlockCard } from '../board/BlockCard'
import { ConflictDialog, type PendingConflict } from '../board/conflict/ConflictDialog'
import { pickDropTarget } from '../board/dnd/collision'
import { performDrop } from '../board/dnd/dropActions'
import { resolveDrop, type DragData, type DropData } from '../board/dnd/dropRules'
import { useToast } from '../toast/toastContext'
import { blockTitle, missingLabel } from './fillRules'
import styles from './FillList.module.css'

type ListFilter = Extract<BlockListFilter, 'needsInput' | 'undated'>

const SECTIONS: readonly { filter: ListFilter; title: string; empty: string }[] = [
  { filter: 'needsInput', title: '채워 주세요', empty: '채울 블록이 없어요.' },
  { filter: 'undated', title: '날짜 없는 일', empty: '날짜 없이 둔 일이 없어요.' }
]

/** 목록 아래 빈 곳: 요소를 놓으면 새 블록으로 분리 (dropRules의 board) */
const SPLIT_DROP: DropData = { kind: 'board' }

/**
 * 오른쪽 목록 패널: 채워 주세요 / 날짜 없는 일. (설계 7.6, 9.6)
 * 항목은 한 줄(제목 + 빠진 것). 누르면 그 자리에서 카드가 펼쳐지고, 한 번에 하나만 펼친다.
 * 빠진 것을 채우면 blocks:changed로 다시 불러와 항목이 저절로 빠진다.
 *
 * 드래그(설계 7.1, 9.6 표): 놓으면 dropRules가 동작을 정하고 dropActions가 코어에 요청한다.
 * - 한 줄 손잡이(⠿)를 다른 항목에 놓으면 합치기
 * - 펼친 카드의 요소를 다른 항목에 놓으면 이동, 목록 아래 빈 곳에 놓으면 분리, 카드 안에서는 순서 바꾸기
 * 같은 종류가 겹치면 충돌 선택 창을 띄운다. 화면 갱신은 blocks:changed가 맡는다.
 */
export function FillList(): React.JSX.Element {
  const lists = {
    needsInput: useBlockList('needsInput'),
    undated: useBlockList('undated')
  }
  const toast = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<DragData | null>(null)
  const [conflict, setConflict] = useState<PendingConflict | null>(null)
  // 6px 이상 움직여야 끌기 시작한다. 그보다 짧으면 클릭(펼치기, 값 편집, 버튼)으로 본다.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const allBlocks = [...(lists.needsInput.data ?? []), ...(lists.undated.data ?? [])]

  const toggle = (blockId: string): void => setOpenId(openId === blockId ? null : blockId)

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
      <div className={styles.list}>
        {SECTIONS.map((section) => (
          <Section
            key={section.filter}
            {...section}
            query={lists[section.filter]}
            openId={openId}
            onToggle={toggle}
          />
        ))}
        <SplitZone dragging={dragging} />
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <div className={styles.overlay}>{previewText(dragging, allBlocks)}</div>}
      </DragOverlay>
      {conflict && <ConflictDialog {...conflict} onClose={() => setConflict(null)} />}
    </DndContext>
  )
}

type SectionProps = {
  filter: ListFilter
  title: string
  empty: string
  query: { data: BlockView[] | undefined; error: Error | null }
  openId: string | null
  onToggle: (blockId: string) => void
}

function Section({
  filter,
  title,
  empty,
  query: { data, error },
  openId,
  onToggle
}: SectionProps): React.JSX.Element {
  return (
    <section className={styles.section}>
      <h3 className={styles.title}>
        {title}
        {data && data.length > 0 && <span className={styles.count}>{data.length}</span>}
      </h3>
      {error ? (
        <p className={styles.message}>{messageForError(error)}</p>
      ) : !data ? (
        <p className={styles.message}>불러오는 중…</p>
      ) : data.length === 0 ? (
        <p className={styles.message}>{empty}</p>
      ) : (
        <ul className={styles.rows}>
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
      )}
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
 * 한 줄 항목. 줄 전체가 놓는 곳(요소는 맨 뒤로 이동, 블록은 합치기)이고 손잡이로 블록을 끈다.
 * 펼치면 아래에 카드가 나온다. 카드의 요소는 끌 수 있고, 블록 손잡이는 줄에만 둔다.
 */
function Row({ block, showMissing, open, onToggle }: RowProps): React.JSX.Element {
  const missing = showMissing ? missingLabel(block) : null
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

  const lineClass = [
    styles.line,
    open ? styles.open : '',
    targeted ? styles.target : '',
    isDragging ? styles.dragging : ''
  ].join(' ')

  return (
    <li className={styles.row}>
      <div ref={setDropRef} className={lineClass}>
        <button
          ref={setDragRef}
          type="button"
          className={styles.handle}
          aria-label="블록 끌어서 합치기"
          {...listeners}
          {...attributes}
        >
          ⠿
        </button>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={onToggle}>
          <span className={styles.arrow}>{open ? '▾' : '▸'}</span>
          <span className={styles.lineTitle}>{blockTitle(block)}</span>
          {missing && <span className={styles.missing}>{missing}</span>}
        </button>
      </div>
      {open && <BlockCard block={block} handle={false} />}
    </li>
  )
}

/** 요소를 놓으면 새 블록으로 나누는 곳. 요소가 둘 이상인 블록의 요소를 끌 때만 안내를 보여준다 */
function SplitZone({ dragging }: { dragging: DragData | null }): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'list-split', data: SPLIT_DROP })
  const active = dragging?.kind === 'element' && dragging.blockSize > 1

  return (
    <div
      ref={setNodeRef}
      className={[
        styles.split,
        active ? styles.splitActive : '',
        active && isOver ? styles.splitOver : ''
      ].join(' ')}
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
  if (!dragging || !target || target.kind === 'board') return false
  return target.blockId === blockId && dragging.blockId !== blockId
}

/** 끄는 동안 마우스를 따라다니는 글자 */
function previewText(dragging: DragData, blocks: readonly BlockView[]): string {
  const block = blocks.find((b) => b.id === dragging.blockId)
  if (!block) return ''
  if (dragging.kind === 'block') return `블록: ${blockTitle(block)}`
  const element = block.elements.find((e) => e.id === dragging.elementId)
  return element ? describeElement(element, new Date().getFullYear()).primary : ''
}
