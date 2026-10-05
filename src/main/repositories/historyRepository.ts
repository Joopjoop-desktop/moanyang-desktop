import { and, asc, eq } from 'drizzle-orm'
import { history } from '../db/schema'
import type { DbExecutor } from './executor'

export type HistoryEntityType = 'block' | 'element'

/** History action 목록 (설계 6.2 History 기록 범위) */
export type HistoryAction =
  | 'element.created'
  | 'element.updated'
  | 'element.moved'
  | 'element.deleted'
  | 'element.discarded'
  | 'block.created'
  | 'block.deleted'
  | 'block.restored'
  | 'block.reviewed'
  | 'block.unreviewed'
  | 'block.completed'
  | 'block.reopened'
  | 'label.attached'
  | 'label.detached'

export type HistoryEntry = {
  entityType: HistoryEntityType
  entityId: string
  action: HistoryAction
  /** 바뀐 필드만. 생성이면 null (설계 6.2 before/after) */
  before: Record<string, unknown> | null
  /** 바뀐 필드만. 삭제·버림이면 null */
  after: Record<string, unknown> | null
}

export type HistoryRow = typeof history.$inferSelect

/**
 * 변경 이력 저장소. 추가 전용이며 수정 메서드를 두지 않는다.
 * 서비스가 변경과 같은 트랜잭션 안에서 record()를 호출한다.
 */
export class HistoryRepository {
  constructor(
    private readonly db: DbExecutor,
    private readonly newId: () => string
  ) {}

  record(entry: HistoryEntry, at: string): void {
    this.db
      .insert(history)
      .values({ id: this.newId(), ...entry, occurredAt: at })
      .run()
  }

  /** 대상 하나의 이력 (기록 순) */
  findByEntity(entityType: HistoryEntityType, entityId: string): HistoryRow[] {
    return this.db
      .select()
      .from(history)
      .where(and(eq(history.entityType, entityType), eq(history.entityId, entityId)))
      .orderBy(asc(history.occurredAt), asc(history.id))
      .all()
  }
}
