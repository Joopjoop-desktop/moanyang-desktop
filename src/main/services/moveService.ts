import type { ConflictPreview, ConflictResolution, MoveResult } from '@shared/moves'
import { analyzeConflicts } from '../domain/conflicts'
import { DomainError } from '../domain/errors'
import {
  planMoveToBlock,
  planReorder,
  planSplit,
  type BlockSnapshot,
  type MovePlan
} from '../domain/moves'
import type { Repositories } from '../repositories'
import type { BlockRow } from '../repositories/blockRepository'
import { toDomainElement, type ElementRow } from '../repositories/elementRepository'
import { inTransaction, type ChangeSet, type ServiceDeps } from './deps'
import { toElementView } from './views'

/** 블록 하나를 읽어 둔 상태 */
type LoadedBlock = {
  row: BlockRow
  elements: ElementRow[]
  snapshot: BlockSnapshot
}

export type MoveElementInput = {
  elementId: string
  targetBlockId: string
  /** 대상 블록의 현재 요소 기준으로 끼울 위치. 없으면 맨 뒤 */
  insertIndex?: number
  /** 충돌 선택이 있을 때만 */
  resolution?: ConflictResolution
}

export type MergeBlocksInput = {
  sourceBlockId: string
  targetBlockId: string
  resolution?: ConflictResolution
}

/**
 * 요소 이동·블록 합치기·분리·순서 변경. (설계 7.1, 7.2, 7.3)
 * 도메인이 계산한 MovePlan을 한 트랜잭션에 반영하고 History를 남긴다.
 */
export class MoveService {
  constructor(private readonly deps: ServiceDeps) {}

  /** 요소 하나를 다른 블록으로 옮길 때의 충돌 미리보기. 아무것도 저장하지 않는다. */
  previewMoveElement(elementId: string, targetBlockId: string): ConflictPreview {
    return inTransaction(this.deps, (repos) => {
      const element = loadElement(repos, elementId)
      const source = loadBlock(repos, element.blockId)
      const target = loadBlock(repos, targetBlockId)
      return buildPreview(source, target, [elementId])
    })
  }

  /** 블록 합치기 충돌 미리보기. 아무것도 저장하지 않는다. */
  previewMergeBlocks(sourceBlockId: string, targetBlockId: string): ConflictPreview {
    return inTransaction(this.deps, (repos) => {
      const source = loadBlock(repos, sourceBlockId)
      const target = loadBlock(repos, targetBlockId)
      return buildPreview(
        source,
        target,
        source.elements.map((e) => e.id)
      )
    })
  }

  /** 같은 블록 안에서 순서를 바꾼다. */
  reorderElement(elementId: string, toIndex: number): MoveResult {
    return inTransaction(this.deps, (repos, changes) => {
      const element = loadElement(repos, elementId)
      const block = loadBlock(repos, element.blockId)
      const plan = planReorder(block.snapshot, elementId, toIndex)
      return this.apply(repos, plan, [block], changes)
    })
  }

  /** 요소를 다른 블록으로 옮긴다. 같은 블록이면 순서 변경으로 처리한다. */
  moveElementToBlock(input: MoveElementInput): MoveResult {
    return inTransaction(this.deps, (repos, changes) => {
      const element = loadElement(repos, input.elementId)
      const source = loadBlock(repos, element.blockId)

      if (source.row.id === input.targetBlockId) {
        const toIndex = input.insertIndex ?? source.elements.length - 1
        const plan = planReorder(source.snapshot, input.elementId, toIndex)
        return this.apply(repos, plan, [source], changes)
      }

      const target = loadBlock(repos, input.targetBlockId)
      assertNotStale(source, target, input.resolution)
      const plan = planMoveToBlock({
        source: source.snapshot,
        target: target.snapshot,
        movingIds: [input.elementId],
        insertIndex: input.insertIndex,
        selection: input.resolution?.selection
      })
      return this.apply(repos, plan, [source, target], changes)
    })
  }

  /** 블록의 모든 요소를 다른 블록 맨 뒤로 옮긴다. 원본 블록은 비어서 emptied로 삭제된다. */
  mergeBlocks(input: MergeBlocksInput): MoveResult {
    if (input.sourceBlockId === input.targetBlockId) {
      throw new Error('mergeBlocks: 같은 블록끼리는 합칠 수 없습니다')
    }
    return inTransaction(this.deps, (repos, changes) => {
      const source = loadBlock(repos, input.sourceBlockId)
      const target = loadBlock(repos, input.targetBlockId)
      assertNotStale(source, target, input.resolution)
      const plan = planMoveToBlock({
        source: source.snapshot,
        target: target.snapshot,
        movingIds: source.elements.map((e) => e.id),
        selection: input.resolution?.selection
      })
      return this.apply(repos, plan, [source, target], changes)
    })
  }

  /** 요소를 빈 곳에 놓아 그 요소만 담은 새 블록을 만든다. */
  splitElement(elementId: string): MoveResult {
    return inTransaction(this.deps, (repos, changes) => {
      const element = loadElement(repos, elementId)
      const source = loadBlock(repos, element.blockId)
      const plan = planSplit({ source: source.snapshot, elementId, newBlockId: this.deps.newId() })
      return this.apply(repos, plan, [source], changes)
    })
  }

  /**
   * MovePlan을 반영하고 History를 남긴다. (설계 6.2 History 기록 범위)
   * 반영 순서: 새 블록 → 이동·순서 변경 → 버림 → 확인 → 순서 재번호 → 빈 블록 삭제 → 블록 updatedAt
   */
  private apply(
    repos: Repositories,
    plan: MovePlan,
    loaded: LoadedBlock[],
    changes: ChangeSet
  ): MoveResult {
    const at = this.deps.now()
    const rows = new Map(loaded.flatMap((block) => block.elements).map((row) => [row.id, row]))
    const rowOf = (id: string): ElementRow => {
      const row = rows.get(id)
      if (!row) throw new Error(`MoveService: 읽어 두지 않은 요소입니다 (${id})`)
      return row
    }
    const finalIndex = new Map<string, number>()
    for (const order of plan.orders) {
      order.elementIds.forEach((id, index) => finalIndex.set(id, index))
    }

    if (plan.createdBlockId) {
      repos.blocks.insert(plan.createdBlockId, at)
      const created = repos.blocks.findLiveById(plan.createdBlockId)
      repos.history.record(
        {
          entityType: 'block',
          entityId: plan.createdBlockId,
          action: 'block.created',
          before: null,
          after: { ...created }
        },
        at
      )
    }

    for (const move of plan.moves) {
      const row = rowOf(move.elementId)
      repos.elements.update(move.elementId, { blockId: move.toBlockId, updatedAt: at })
      repos.history.record(
        {
          entityType: 'element',
          entityId: move.elementId,
          action: 'element.moved',
          before: { blockId: row.blockId, orderIndex: row.orderIndex },
          after: { blockId: move.toBlockId, orderIndex: finalIndex.get(move.elementId) ?? null }
        },
        at
      )
    }

    for (const reorder of plan.reorders) {
      const row = rowOf(reorder.elementId)
      repos.elements.update(reorder.elementId, { updatedAt: at })
      repos.history.record(
        {
          entityType: 'element',
          entityId: reorder.elementId,
          action: 'element.moved',
          before: { orderIndex: row.orderIndex },
          after: { orderIndex: finalIndex.get(reorder.elementId) ?? null }
        },
        at
      )
    }

    for (const discard of plan.discards) {
      const row = rowOf(discard.elementId)
      repos.elements.softDelete(discard.elementId, 'discarded', at)
      repos.history.record(
        {
          entityType: 'element',
          entityId: discard.elementId,
          action: 'element.discarded',
          before: { ...row },
          after: { deletedAt: at, deleteReason: 'discarded', cause: discard.cause }
        },
        at
      )
    }

    for (const elementId of plan.confirms) {
      repos.elements.update(elementId, { needsConfirm: false, updatedAt: at })
      repos.history.record(
        {
          entityType: 'element',
          entityId: elementId,
          action: 'element.updated',
          before: { needsConfirm: true },
          after: { needsConfirm: false }
        },
        at
      )
    }

    for (const order of plan.orders) {
      repos.elements.applyOrder(order.elementIds)
    }

    const emptiedIds = new Set<string>()
    for (const emptied of plan.emptiedBlocks) {
      emptiedIds.add(emptied.blockId)
      for (const label of repos.labels.findAttachedToBlock(emptied.blockId)) {
        repos.labels.detach(emptied.blockId, label.id)
        repos.history.record(
          {
            entityType: 'block',
            entityId: emptied.blockId,
            action: 'label.detached',
            before: { labelId: label.id, attachedAt: label.attachedAt },
            after: null
          },
          at
        )
      }
      const blockRow = repos.blocks.findLiveById(emptied.blockId)
      repos.blocks.softDelete(emptied.blockId, emptied.deleteReason, at)
      repos.history.record(
        {
          entityType: 'block',
          entityId: emptied.blockId,
          action: 'block.deleted',
          before: { ...blockRow },
          after: { deletedAt: at, deleteReason: emptied.deleteReason }
        },
        at
      )
    }

    const nothingChanged =
      plan.moves.length === 0 && plan.reorders.length === 0 && plan.discards.length === 0
    const changedBlockIds = nothingChanged ? [] : loaded.map((block) => block.row.id)
    for (const blockId of changedBlockIds) {
      if (!emptiedIds.has(blockId)) repos.blocks.touch(blockId, at)
    }

    const result: MoveResult = {
      changedBlockIds: plan.createdBlockId
        ? [...changedBlockIds, plan.createdBlockId]
        : changedBlockIds,
      createdBlockId: plan.createdBlockId
    }
    for (const blockId of result.changedBlockIds) changes.add(blockId)
    return result
  }
}

function loadElement(repos: Repositories, elementId: string): ElementRow {
  const element = repos.elements.findLiveById(elementId)
  if (!element) throw new DomainError('ELEMENT_NOT_FOUND', `요소가 없습니다: ${elementId}`)
  return element
}

function loadBlock(repos: Repositories, blockId: string): LoadedBlock {
  const row = repos.blocks.findLiveById(blockId)
  if (!row) throw new DomainError('BLOCK_NOT_FOUND', `블록이 없습니다: ${blockId}`)
  const elements = repos.elements.findLiveByBlock(blockId)
  return { row, elements, snapshot: { blockId, elements: elements.map(toDomainElement) } }
}

/** 충돌 선택이 있는 이동은 미리보기 이후 블록이 바뀌지 않았는지 확인한다. (설계 7.1) */
function assertNotStale(
  source: LoadedBlock,
  target: LoadedBlock,
  resolution: ConflictResolution | undefined
): void {
  if (!resolution) return
  const { sourceUpdatedAt, targetUpdatedAt } = resolution.previewed
  if (sourceUpdatedAt !== source.row.updatedAt || targetUpdatedAt !== target.row.updatedAt) {
    throw new DomainError('CONFLICT_PREVIEW_STALE', '미리보기 이후 블록이 바뀌었습니다')
  }
}

function buildPreview(
  source: LoadedBlock,
  target: LoadedBlock,
  movingIds: readonly string[]
): ConflictPreview {
  const moving = new Set(movingIds)
  const incoming = source.elements.filter((row) => moving.has(row.id))
  const analysis = analyzeConflicts(target.snapshot.elements, incoming.map(toDomainElement))

  const rows = new Map([...source.elements, ...target.elements].map((row) => [row.id, row]))
  const view = (id: string): ReturnType<typeof toElementView> => {
    const row = rows.get(id)
    if (!row) throw new Error(`buildPreview: 요소를 찾을 수 없습니다 (${id})`)
    return toElementView(row)
  }

  return {
    sourceBlockId: source.row.id,
    targetBlockId: target.row.id,
    sourceUpdatedAt: source.row.updatedAt,
    targetUpdatedAt: target.row.updatedAt,
    requiresSelection: analysis.conflictGroups.length > 0,
    autoDiscardedIds: analysis.autoDiscards.map((d) => d.discardedId),
    groups: analysis.conflictGroups.map((group) => ({
      type: group.type,
      existing: group.existingIds.map(view),
      incoming: group.incomingIds.map(view)
    }))
  }
}
