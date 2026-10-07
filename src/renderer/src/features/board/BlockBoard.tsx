import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
import { useToast } from '../toast/toastContext'
import { BlockCard } from './BlockCard'
import styles from './BlockBoard.module.css'
import { pickDropTarget } from './dnd/collision'
import { performDrop } from './dnd/dropActions'
import { resolveDrop, type DragData, type DropData } from './dnd/dropRules'
import { TABS } from './tabs'

const BOARD_DROP: DropData = { kind: 'board' }

/**
 * 오른쪽 블록 보드: 고른 탭의 블록 카드 목록과 드래그. (설계 7.1, 9.6)
 * 놓으면 dropRules가 동작을 정하고 dropActions가 코어에 요청한다. 화면 갱신은 blocks:changed가 맡는다.
 */
export function BlockBoard({ filter }: { filter: BlockListFilter }): React.JSX.Element {
  const { data, error } = useBlockList(filter)
  const toast = useToast()
  const [dragging, setDragging] = useState<DragData | null>(null)
  // 6px 이상 움직여야 끌기 시작한다. 그보다 짧으면 클릭(값 편집, 버튼)으로 본다.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
          // 충돌 선택 창은 6-6에서 붙인다
          toast.show({ message: '같은 종류 요소가 겹쳐요. 고르는 창은 아직 준비 중이에요.' })
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
      <BoardSurface filter={filter} blocks={data} error={error} dragging={dragging} />
      <DragOverlay dropAnimation={null}>
        {dragging && <div className={styles.overlay}>{previewText(dragging, data ?? [])}</div>}
      </DragOverlay>
    </DndContext>
  )
}

type SurfaceProps = {
  filter: BlockListFilter
  blocks: BlockView[] | undefined
  error: Error | null
  dragging: DragData | null
}

/** 보드 화면. 빈 곳은 요소를 놓아 분리하는 곳이다(DndContext 안에 있어야 등록된다). 휴지통은 끌 수 없다. */
function BoardSurface({ filter, blocks, error, dragging }: SurfaceProps): React.JSX.Element {
  const tab = TABS.find((t) => t.filter === filter)
  const { setNodeRef, isOver } = useDroppable({
    id: 'board',
    data: BOARD_DROP,
    disabled: filter === 'trash'
  })
  const splitting = isOver && dragging?.kind === 'element' && dragging.blockSize > 1

  return (
    <section
      ref={setNodeRef}
      className={splitting ? `${styles.board} ${styles.splitting}` : styles.board}
    >
      <h2 className={styles.title}>
        {tab?.label}
        {splitting && <span className={styles.hint}>여기에 놓으면 새 블록으로 나눠요</span>}
      </h2>
      {error ? (
        <p className={styles.message}>{messageForError(error)}</p>
      ) : !blocks ? (
        <p className={styles.message}>불러오는 중…</p>
      ) : blocks.length === 0 ? (
        <p className={styles.message}>{tab?.empty}</p>
      ) : (
        <div className={styles.grid}>
          {blocks.map((block) => (
            <BlockCard key={block.id} block={block} />
          ))}
        </div>
      )}
    </section>
  )
}

/** 끄는 동안 마우스를 따라다니는 글자 */
function previewText(dragging: DragData, blocks: readonly BlockView[]): string {
  const block = blocks.find((b) => b.id === dragging.blockId)
  const element =
    dragging.kind === 'element'
      ? block?.elements.find((e) => e.id === dragging.elementId)
      : block?.elements[0]
  const text = element ? describeElement(element, new Date().getFullYear()).primary : ''
  return dragging.kind === 'block' ? `블록: ${text}` : text
}
