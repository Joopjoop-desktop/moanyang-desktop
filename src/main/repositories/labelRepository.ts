import { and, asc, eq } from 'drizzle-orm'
import { blockLabels, labels } from '../db/schema'
import type { DbExecutor } from './executor'

export type LabelRow = typeof labels.$inferSelect
export type AttachedLabelRow = LabelRow & { attachedAt: string }

export class LabelRepository {
  constructor(private readonly db: DbExecutor) {}

  findAll(): LabelRow[] {
    return this.db.select().from(labels).orderBy(asc(labels.name)).all()
  }

  findById(id: string): LabelRow | undefined {
    return this.db.select().from(labels).where(eq(labels.id, id)).get()
  }

  /** 블록에 붙은 라벨 (붙인 순) */
  findAttachedToBlock(blockId: string): AttachedLabelRow[] {
    return this.db
      .select({ label: labels, attachedAt: blockLabels.attachedAt })
      .from(blockLabels)
      .innerJoin(labels, eq(blockLabels.labelId, labels.id))
      .where(eq(blockLabels.blockId, blockId))
      .orderBy(asc(blockLabels.attachedAt))
      .all()
      .map((row) => ({ ...row.label, attachedAt: row.attachedAt }))
  }

  attach(blockId: string, labelId: string, at: string): void {
    this.db.insert(blockLabels).values({ blockId, labelId, attachedAt: at }).run()
  }

  detach(blockId: string, labelId: string): void {
    this.db
      .delete(blockLabels)
      .where(and(eq(blockLabels.blockId, blockId), eq(blockLabels.labelId, labelId)))
      .run()
  }
}
