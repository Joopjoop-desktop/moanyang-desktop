import { and, asc, eq, inArray, lt, notExists } from 'drizzle-orm'
import type { CaptureErrorCode } from '@shared/captures'
import type { CaptureStatus } from '@shared/model'
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
   * 현재 상태가 from 중 하나일 때만 to로 바꾼다. 확인과 변경이 한 문장이라 중간에 끼어들 수 없다.
   * 상태가 맞지 않거나 Capture가 없으면 바꾸지 않는다. (설계 8.7 중복 처리 방지)
   * @returns 바꿨는지
   */
  transition(
    id: string,
    from: readonly CaptureStatus[],
    to: CaptureStatus,
    errorCode: CaptureErrorCode | null
  ): boolean {
    return (
      this.db
        .update(captures)
        .set({ status: to, errorCode })
        .where(and(eq(captures.id, id), inArray(captures.status, [...from])))
        .run().changes > 0
    )
  }

  /** 앱 시작 시: 처리 중이던(pending, extracting) Capture를 모두 실패로 바꾼다. (설계 8.2) */
  failUnfinished(errorCode: CaptureErrorCode): number {
    return this.db
      .update(captures)
      .set({ status: 'failed', errorCode })
      .where(inArray(captures.status, ['pending', 'extracting']))
      .run().changes
  }

  /** 실패 카드 목록 (먹인 순) */
  findFailed(): CaptureRow[] {
    return this.db
      .select()
      .from(captures)
      .where(eq(captures.status, 'failed'))
      .orderBy(asc(captures.capturedAt), asc(captures.id))
      .all()
  }

  /**
   * 실패 카드 닫기: failed인 Capture만 지운다. 실패한 Capture에는 연결된 요소가 없다. (설계 6.4)
   * @returns 지웠는지
   */
  deleteFailed(id: string): boolean {
    return (
      this.db
        .delete(captures)
        .where(and(eq(captures.id, id), eq(captures.status, 'failed')))
        .run().changes > 0
    )
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
