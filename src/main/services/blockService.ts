import type { BlockListFilter, BlockView } from '@shared/views'
import { DomainError } from '../domain/errors'
import type { Repositories } from '../repositories'
import type { BlockRow } from '../repositories/blockRepository'
import { inTransaction, type ServiceDeps } from './deps'
import { toBlockView } from './views'

/**
 * 블록 조회와 상태 변경. (설계 7.3, 7.4)
 * 상태는 사용자가 직접 바꿀 때만 바뀐다. 이미 그 상태면 아무것도 바꾸지 않는다.
 */
export class BlockService {
  constructor(private readonly deps: ServiceDeps) {}

  list(filter: BlockListFilter): BlockView[] {
    return inTransaction(this.deps, (repos) =>
      repos.blocks.list(filter).map((row) => buildView(repos, row))
    )
  }

  get(blockId: string): BlockView {
    return inTransaction(this.deps, (repos) => buildView(repos, loadLiveBlock(repos, blockId)))
  }

  /** 검토 완료 / 검토 취소 */
  setReviewed(blockId: string, reviewed: boolean): BlockView {
    return this.setTimestamp(blockId, 'reviewedAt', reviewed, {
      on: 'block.reviewed',
      off: 'block.unreviewed'
    })
  }

  /** 완료 / 되돌리기 */
  setCompleted(blockId: string, completed: boolean): BlockView {
    return this.setTimestamp(blockId, 'completedAt', completed, {
      on: 'block.completed',
      off: 'block.reopened'
    })
  }

  /** 휴지통으로 보낸다. 요소와 라벨 연결은 그대로 두어 복구 시 함께 돌아온다. (설계 7.3) */
  delete(blockId: string): void {
    inTransaction(this.deps, (repos, changes) => {
      const row = loadLiveBlock(repos, blockId)
      const at = this.deps.now()
      repos.blocks.softDelete(blockId, 'user', at)
      changes.add(blockId)
      repos.history.record(
        {
          entityType: 'block',
          entityId: blockId,
          action: 'block.deleted',
          before: { ...row },
          after: { deletedAt: at, deleteReason: 'user' }
        },
        at
      )
    })
  }

  /** 휴지통에서 복구한다. 사용자가 삭제한 블록만 복구할 수 있다 (emptied는 휴지통에 없음). */
  restore(blockId: string): BlockView {
    return inTransaction(this.deps, (repos, changes) => {
      const row = repos.blocks.findByIdIncludingDeleted(blockId)
      if (!row || row.deleteReason !== 'user') {
        throw new DomainError('BLOCK_NOT_FOUND', `휴지통에 없는 블록입니다: ${blockId}`)
      }
      const at = this.deps.now()
      repos.blocks.restore(blockId, at)
      changes.add(blockId)
      repos.history.record(
        {
          entityType: 'block',
          entityId: blockId,
          action: 'block.restored',
          before: { deletedAt: row.deletedAt, deleteReason: row.deleteReason },
          after: { deletedAt: null, deleteReason: null }
        },
        at
      )
      return buildView(repos, loadLiveBlock(repos, blockId))
    })
  }

  private setTimestamp(
    blockId: string,
    field: 'reviewedAt' | 'completedAt',
    on: boolean,
    actions: {
      on: 'block.reviewed' | 'block.completed'
      off: 'block.unreviewed' | 'block.reopened'
    }
  ): BlockView {
    return inTransaction(this.deps, (repos, changes) => {
      const row = loadLiveBlock(repos, blockId)
      if ((row[field] !== null) === on) return buildView(repos, row)

      const at = this.deps.now()
      const next = on ? at : null
      const patch = field === 'reviewedAt' ? { reviewedAt: next } : { completedAt: next }
      repos.blocks.update(blockId, { ...patch, updatedAt: at })
      changes.add(blockId)
      repos.history.record(
        {
          entityType: 'block',
          entityId: blockId,
          action: on ? actions.on : actions.off,
          before: { [field]: row[field] },
          after: { [field]: next }
        },
        at
      )
      return buildView(repos, loadLiveBlock(repos, blockId))
    })
  }
}

function loadLiveBlock(repos: Repositories, blockId: string): BlockRow {
  const row = repos.blocks.findLiveById(blockId)
  if (!row) throw new DomainError('BLOCK_NOT_FOUND', `블록이 없습니다: ${blockId}`)
  return row
}

/** 휴지통 블록이면 복구 시 돌아올 요소를, 아니면 살아 있는 요소를 담는다. */
function buildView(repos: Repositories, row: BlockRow): BlockView {
  const elements = row.deletedAt
    ? repos.elements.findByBlockIncludingDeletedBlock(row.id)
    : repos.elements.findLiveByBlock(row.id)
  return toBlockView(row, elements, repos.labels.findAttachedToBlock(row.id))
}
