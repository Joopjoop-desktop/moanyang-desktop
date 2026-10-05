import { and, eq, isNull } from 'drizzle-orm'
import type { BlockDeleteReason } from '@shared/model'
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
}
