import { and, asc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import type { ElementDeleteReason } from '@shared/model'
import { blocks, elements } from '../db/schema'
import type { DomainElement } from '../domain/types'
import type { DbExecutor } from './executor'

export type ElementRow = typeof elements.$inferSelect
export type NewElementRow = typeof elements.$inferInsert
export type ElementPatch = Partial<Omit<ElementRow, 'id' | 'createdAt'>>

/** 살아 있는 요소 조건. blocks와 join한 쿼리에서만 쓴다. (설계 6.5) */
const LIVE = and(isNull(elements.deletedAt), isNull(blocks.deletedAt))

/**
 * 요소 저장소. (설계 6.5)
 * 기본 조회는 "살아 있는 요소"만 돌려준다: 요소 deletedAt이 null이고 속한 블록 deletedAt도 null.
 * 삭제된 요소까지 봐야 하면 IncludingDeleted 메서드를 쓴다.
 */
export class ElementRepository {
  constructor(private readonly db: DbExecutor) {}

  /** 블록의 살아 있는 요소 (orderIndex 순) */
  findLiveByBlock(blockId: string): ElementRow[] {
    return this.db
      .select({ element: elements })
      .from(elements)
      .innerJoin(blocks, eq(elements.blockId, blocks.id))
      .where(and(eq(elements.blockId, blockId), LIVE))
      .orderBy(asc(elements.orderIndex))
      .all()
      .map((row) => row.element)
  }

  findLiveById(id: string): ElementRow | undefined {
    const row = this.db
      .select({ element: elements })
      .from(elements)
      .innerJoin(blocks, eq(elements.blockId, blocks.id))
      .where(and(eq(elements.id, id), LIVE))
      .get()
    return row?.element
  }

  /**
   * 달력 후보: 살아 있는 시작일·마감일 중 가장 이른 날짜 ≤ to 이고 가장 늦은 날짜 ≥ from인 블록. (설계 7.5)
   * 조회 기간 안에 날짜가 없어도 기간을 가로지르는 블록까지 잡도록 넓게 고른다.
   * 실제로 겹치는지는 서비스가 도메인 계산(overlapsRange)으로 다시 거른다.
   * 날짜 없이 원래 표현만 있는 요소(dateValue null)는 보지 않는다.
   */
  findBlockIdsWithDatesAround(from: string, to: string): string[] {
    return this.db
      .select({ blockId: elements.blockId })
      .from(elements)
      .innerJoin(blocks, eq(elements.blockId, blocks.id))
      .where(
        and(LIVE, inArray(elements.type, ['start_date', 'due_date']), isNotNull(elements.dateValue))
      )
      .groupBy(elements.blockId)
      .having(sql`min(${elements.dateValue}) <= ${to} and max(${elements.dateValue}) >= ${from}`)
      .all()
      .map((row) => row.blockId)
  }

  findByIdIncludingDeleted(id: string): ElementRow | undefined {
    return this.db.select().from(elements).where(eq(elements.id, id)).get()
  }

  /**
   * 휴지통 블록 화면용: 블록이 삭제됐어도 요소 자체가 삭제되지 않았으면 돌려준다 (orderIndex 순).
   * 블록을 복구하면 돌아올 요소들이다. (설계 7.3)
   */
  findByBlockIncludingDeletedBlock(blockId: string): ElementRow[] {
    return this.db
      .select()
      .from(elements)
      .where(and(eq(elements.blockId, blockId), isNull(elements.deletedAt)))
      .orderBy(asc(elements.orderIndex))
      .all()
  }

  /** 하드 딜리트용: 블록들에 속한 요소 ID 전부 (삭제 여부와 상관없이) */
  findIdsByBlocksIncludingDeleted(blockIds: readonly string[]): string[] {
    if (blockIds.length === 0) return []
    return this.db
      .select({ id: elements.id })
      .from(elements)
      .where(inArray(elements.blockId, [...blockIds]))
      .all()
      .map((row) => row.id)
  }

  /** 하드 딜리트 대상: 요소 자신이 삭제된 지 cutoff보다 오래된 요소 (블록 상태와 상관없이) */
  findExpiredIds(cutoff: string): string[] {
    return this.db
      .select({ id: elements.id })
      .from(elements)
      .where(and(isNotNull(elements.deletedAt), lt(elements.deletedAt, cutoff)))
      .all()
      .map((row) => row.id)
  }

  deleteByIds(ids: readonly string[]): void {
    if (ids.length === 0) return
    this.db
      .delete(elements)
      .where(inArray(elements.id, [...ids]))
      .run()
  }

  insert(row: NewElementRow): void {
    this.db.insert(elements).values(row).run()
  }

  update(id: string, patch: ElementPatch): void {
    this.db.update(elements).set(patch).where(eq(elements.id, id)).run()
  }

  softDelete(id: string, reason: ElementDeleteReason, at: string): void {
    this.update(id, { deletedAt: at, deleteReason: reason, updatedAt: at })
  }

  /**
   * 블록의 최종 순서대로 orderIndex를 0부터 다시 매긴다.
   * 재번호는 History에 남기지 않는다. (설계 6.2 History 기록 범위)
   */
  applyOrder(elementIds: readonly string[]): void {
    elementIds.forEach((id, index) => {
      this.db.update(elements).set({ orderIndex: index }).where(eq(elements.id, id)).run()
    })
  }
}

/** DB 행을 도메인 계산용 요소로 바꾼다. */
export function toDomainElement(row: ElementRow): DomainElement {
  return {
    id: row.id,
    blockId: row.blockId,
    type: row.type,
    value: row.value,
    dateValue: row.dateValue,
    timeValue: row.timeValue,
    needsConfirm: row.needsConfirm,
    orderIndex: row.orderIndex
  }
}
