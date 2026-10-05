import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseConnection } from '../db/connection'
import { createTestDatabase } from '../db/testDatabase'
import { newId } from '../infra/id'
import { createRepositories, type Repositories } from '.'

const AT = '2026-10-06T00:00:00.000Z'
const LATER = '2026-10-06T01:00:00.000Z'

describe('저장소', () => {
  let connection: DatabaseConnection
  let repos: Repositories

  beforeEach(() => {
    connection = createTestDatabase()
    repos = createRepositories(connection.db, newId)
  })

  afterEach(() => {
    connection.close()
  })

  function addElement(id: string, blockId: string, orderIndex: number): void {
    repos.elements.insert({
      id,
      blockId,
      type: 'memo',
      value: id,
      orderIndex,
      createdAt: AT,
      updatedAt: AT
    })
  }

  describe('ElementRepository 소프트 딜리트 필터 (설계 6.5)', () => {
    beforeEach(() => {
      repos.blocks.insert('b1', AT)
      addElement('e1', 'b1', 0)
      addElement('e2', 'b1', 1)
    })

    it('살아 있는 요소를 순서대로 돌려준다', () => {
      expect(repos.elements.findLiveByBlock('b1').map((e) => e.id)).toEqual(['e1', 'e2'])
    })

    it('삭제된 요소는 기본 조회에서 빠진다', () => {
      repos.elements.softDelete('e1', 'user', LATER)

      expect(repos.elements.findLiveByBlock('b1').map((e) => e.id)).toEqual(['e2'])
      expect(repos.elements.findLiveById('e1')).toBeUndefined()
    })

    it('블록이 삭제되면 요소 deletedAt이 비어 있어도 기본 조회에서 빠진다', () => {
      repos.blocks.softDelete('b1', 'user', LATER)

      expect(repos.elements.findLiveByBlock('b1')).toEqual([])
      expect(repos.elements.findLiveById('e2')).toBeUndefined()
      expect(repos.elements.findByIdIncludingDeleted('e2')?.deletedAt).toBeNull()
    })

    it('삭제 포함 조회는 삭제된 요소도 돌려준다', () => {
      repos.elements.softDelete('e1', 'discarded', LATER)

      const row = repos.elements.findByIdIncludingDeleted('e1')
      expect(row?.deletedAt).toBe(LATER)
      expect(row?.deleteReason).toBe('discarded')
    })

    it('applyOrder는 순서대로 0부터 다시 매긴다', () => {
      repos.elements.applyOrder(['e2', 'e1'])

      expect(repos.elements.findLiveByBlock('b1').map((e) => [e.id, e.orderIndex])).toEqual([
        ['e2', 0],
        ['e1', 1]
      ])
    })
  })

  describe('BlockRepository', () => {
    it('새 블록은 기본 상태로 만들어진다', () => {
      repos.blocks.insert('b1', AT)

      expect(repos.blocks.findLiveById('b1')).toMatchObject({
        reviewedAt: null,
        completedAt: null,
        deletedAt: null,
        createdAt: AT,
        updatedAt: AT
      })
    })

    it('삭제된 블록은 기본 조회에서 빠진다', () => {
      repos.blocks.insert('b1', AT)
      repos.blocks.softDelete('b1', 'emptied', LATER)

      expect(repos.blocks.findLiveById('b1')).toBeUndefined()
      expect(repos.blocks.findByIdIncludingDeleted('b1')?.deleteReason).toBe('emptied')
    })

    it('touch는 updatedAt만 바꾼다', () => {
      repos.blocks.insert('b1', AT)
      repos.blocks.touch('b1', LATER)

      expect(repos.blocks.findLiveById('b1')).toMatchObject({ createdAt: AT, updatedAt: LATER })
    })
  })

  describe('LabelRepository', () => {
    it('블록에 라벨을 붙이고 뗀다', () => {
      repos.blocks.insert('b1', AT)
      const label = repos.labels.findAll().find((l) => l.key === 'waiting_reply')
      if (!label) throw new Error('시스템 라벨이 없습니다')

      repos.labels.attach('b1', label.id, AT)
      expect(repos.labels.findAttachedToBlock('b1')).toMatchObject([
        { id: label.id, attachedAt: AT }
      ])

      repos.labels.detach('b1', label.id)
      expect(repos.labels.findAttachedToBlock('b1')).toEqual([])
    })
  })

  describe('HistoryRepository', () => {
    it('before/after를 JSON으로 저장하고 그대로 읽는다', () => {
      repos.history.record(
        {
          entityType: 'element',
          entityId: 'e1',
          action: 'element.moved',
          before: { blockId: 'b1', orderIndex: 0 },
          after: { blockId: 'b2', orderIndex: 3 }
        },
        AT
      )

      expect(repos.history.findByEntity('element', 'e1')).toMatchObject([
        {
          action: 'element.moved',
          before: { blockId: 'b1', orderIndex: 0 },
          after: { blockId: 'b2', orderIndex: 3 },
          occurredAt: AT
        }
      ])
    })

    it('같은 시각에 기록해도 기록한 순서대로 읽는다', () => {
      for (const action of ['element.created', 'element.updated', 'element.moved'] as const) {
        repos.history.record(
          { entityType: 'element', entityId: 'e1', action, before: null, after: null },
          AT
        )
      }

      expect(repos.history.findByEntity('element', 'e1').map((h) => h.action)).toEqual([
        'element.created',
        'element.updated',
        'element.moved'
      ])
    })
  })

  it('트랜잭션이 실패하면 저장소로 쓴 내용이 모두 취소된다', () => {
    const attempt = (): void => {
      connection.db.transaction((tx) => {
        const txRepos = createRepositories(tx, newId)
        txRepos.blocks.insert('b1', AT)
        throw new Error('rollback')
      })
    }

    expect(attempt).toThrow('rollback')
    expect(repos.blocks.findByIdIncludingDeleted('b1')).toBeUndefined()
  })
})
