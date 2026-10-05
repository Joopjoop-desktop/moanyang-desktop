import { and, asc, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm'
import type { BlockDeleteReason } from '@shared/model'
import type { BlockListFilter } from '@shared/views'
import { blocks } from '../db/schema'
import type { DbExecutor } from './executor'

export type BlockRow = typeof blocks.$inferSelect
export type BlockPatch = Partial<Omit<BlockRow, 'id' | 'createdAt'>>

/**
 * 블록 저장소. 기본 조회는 삭제되지 않은 블록만 돌려준다. (설계 6.5)
 */
export class BlockRepository {
  constructor(private readonly db: DbExecutor) {}

  findLiveById(id: string): BlockRow | undefined {
    return this.db
      .select()
      .from(blocks)
      .where(and(eq(blocks.id, id), isNull(blocks.deletedAt)))
      .get()
  }

  findByIdIncludingDeleted(id: string): BlockRow | undefined {
    return this.db.select().from(blocks).where(eq(blocks.id, id)).get()
  }

  /**
   * 목록 조회.
   * - inbox: 검토 전이고 미완료 (최신순)
   * - all: 삭제되지 않은 블록 전체 (최신순)
   * - completed: 완료 (완료 최신순)
   * - trash: 사용자가 삭제한 블록만 (삭제 최신순). emptied는 보이지 않는다 (설계 7.3)
   * 같은 시각에 만든 블록(같은 먹이에서 나온 블록)은 만든 순서대로 나란히 놓인다.
   */
  list(filter: BlockListFilter): BlockRow[] {
    const query = this.db.select().from(blocks)
    switch (filter) {
      case 'inbox':
        return query
          .where(
            and(isNull(blocks.deletedAt), isNull(blocks.reviewedAt), isNull(blocks.completedAt))
          )
          .orderBy(desc(blocks.createdAt), asc(blocks.id))
          .all()
      case 'all':
        return query
          .where(isNull(blocks.deletedAt))
          .orderBy(desc(blocks.createdAt), asc(blocks.id))
          .all()
      case 'completed':
        return query
          .where(and(isNull(blocks.deletedAt), isNotNull(blocks.completedAt)))
          .orderBy(desc(blocks.completedAt), asc(blocks.id))
          .all()
      case 'trash':
        return query
          .where(eq(blocks.deleteReason, 'user'))
          .orderBy(desc(blocks.deletedAt), asc(blocks.id))
          .all()
    }
  }

  /** 기본 상태(검토 전, 미완료, 라벨 없음)로 만든다. (설계 7.4) */
  insert(id: string, at: string): void {
    this.db.insert(blocks).values({ id, createdAt: at, updatedAt: at }).run()
  }

  update(id: string, patch: BlockPatch): void {
    this.db.update(blocks).set(patch).where(eq(blocks.id, id)).run()
  }

  /** 블록이나 그 안의 요소가 바뀌었음을 기록한다. 미리보기 이후 변경 감지에 쓴다. (설계 6.4) */
  touch(id: string, at: string): void {
    this.update(id, { updatedAt: at })
  }

  softDelete(id: string, reason: BlockDeleteReason, at: string): void {
    this.update(id, { deletedAt: at, deleteReason: reason, updatedAt: at })
  }

  restore(id: string, at: string): void {
    this.update(id, { deletedAt: null, deleteReason: null, updatedAt: at })
  }

  /** 하드 딜리트 대상: 삭제된 지 cutoff보다 오래된 블록 (user, emptied 모두) */
  findExpiredIds(cutoff: string): string[] {
    return this.db
      .select({ id: blocks.id })
      .from(blocks)
      .where(and(isNotNull(blocks.deletedAt), lt(blocks.deletedAt, cutoff)))
      .all()
      .map((row) => row.id)
  }

  /** 하드 딜리트. 요소와 라벨 연결은 CASCADE로 함께 지워진다. */
  deleteByIds(ids: readonly string[]): void {
    if (ids.length === 0) return
    this.db
      .delete(blocks)
      .where(inArray(blocks.id, [...ids]))
      .run()
  }
}
