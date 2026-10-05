import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { blocks, elements, labels } from './schema'
import { createTestDatabase } from './testDatabase'
import type { DatabaseConnection } from './connection'

const NOW = '2026-10-06T00:00:00.000Z'

describe('테스트용 메모리 DB', () => {
  let connection: DatabaseConnection

  beforeEach(() => {
    connection = createTestDatabase()
  })

  afterEach(() => {
    connection.close()
  })

  it('마이그레이션이 적용되어 테이블이 있다', () => {
    const rows = connection.db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    )
    const names = rows.map((row) => row.name)

    for (const table of ['captures', 'blocks', 'elements', 'labels', 'block_labels', 'history']) {
      expect(names).toContain(table)
    }
  })

  it('시스템 라벨이 들어 있다', () => {
    const keys = connection.db
      .select({ key: labels.key })
      .from(labels)
      .all()
      .map((row) => row.key)

    expect(keys.sort()).toEqual(['coordinating', 'waiting_reply'])
  })

  it('외래 키 검사가 켜져 있다', () => {
    const insertOrphan = (): void => {
      connection.db
        .insert(elements)
        .values({
          id: 'e1',
          blockId: 'no-such-block',
          type: 'memo',
          orderIndex: 0,
          createdAt: NOW,
          updatedAt: NOW
        })
        .run()
    }

    expect(insertOrphan).toThrow()
  })

  it('블록을 하드 딜리트하면 요소도 함께 지워진다 (CASCADE)', () => {
    const { db } = connection
    db.insert(blocks).values({ id: 'b1', createdAt: NOW, updatedAt: NOW }).run()
    db.insert(elements)
      .values({
        id: 'e1',
        blockId: 'b1',
        type: 'memo',
        orderIndex: 0,
        createdAt: NOW,
        updatedAt: NOW
      })
      .run()

    db.delete(blocks).where(eq(blocks.id, 'b1')).run()

    expect(db.select().from(elements).all()).toEqual([])
  })

  it('테스트마다 새 DB가 열린다', () => {
    expect(connection.db.select().from(blocks).all()).toEqual([])
  })
})
