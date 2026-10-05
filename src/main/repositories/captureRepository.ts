import { and, eq, inArray, lt, notExists } from 'drizzle-orm'
import { captures, elements } from '../db/schema'
import type { DbExecutor } from './executor'

export type CaptureRow = typeof captures.$inferSelect
export type NewCaptureRow = typeof captures.$inferInsert

/** 먹이(Capture) 저장소. 원문은 저장하지 않는다. (설계 6.2) */
export class CaptureRepository {
  constructor(private readonly db: DbExecutor) {}

  findById(id: string): CaptureRow | undefined {
    return this.db.select().from(captures).where(eq(captures.id, id)).get()
  }

  insert(row: NewCaptureRow): void {
    this.db.insert(captures).values(row).run()
  }

  /**
   * 하드 딜리트: 처리가 끝났고(done, failed) 연결된 요소가 없으며 기간이 지난 Capture를 지운다.
   * (설계 6.4 하드 딜리트) 처리 중(pending, extracting)인 Capture는 건드리지 않는다.
   * @returns 지운 개수
   */
  deleteExpiredOrphans(cutoff: string): number {
    return this.db
      .delete(captures)
      .where(
        and(
          lt(captures.capturedAt, cutoff),
          inArray(captures.status, ['done', 'failed']),
          notExists(this.db.select().from(elements).where(eq(elements.captureId, captures.id)))
        )
      )
      .run().changes
  }
}
