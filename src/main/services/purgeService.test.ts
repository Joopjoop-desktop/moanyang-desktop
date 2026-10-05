import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CaptureStatus } from '@shared/model'
import { PurgeService } from './purgeService'
import {
  SEED_AT,
  historyActions,
  seedBlock,
  seedElement,
  setupServiceTest,
  type ServiceTestContext
} from './testSupport'

// 테스트 시계는 2026-10-06부터 시작한다. 보관 기간 30일 → 2026-09-06 이전이면 만료
const EXPIRED = '2026-09-01T00:00:00.000Z'
const RECENT = '2026-09-20T00:00:00.000Z'

describe('PurgeService', () => {
  let ctx: ServiceTestContext
  let service: PurgeService

  beforeEach(() => {
    ctx = setupServiceTest()
    service = new PurgeService(ctx.deps)
  })

  afterEach(() => {
    ctx.connection.close()
  })

  function recordHistory(entityType: 'block' | 'element', entityId: string): void {
    ctx.repos.history.record(
      { entityType, entityId, action: 'element.updated', before: null, after: null },
      SEED_AT
    )
  }

  function seedCapture(id: string, status: CaptureStatus, capturedAt: string): void {
    ctx.repos.captures.insert({ id, method: 'paste', status, capturedAt })
  }

  it('삭제된 지 오래된 블록을 요소·라벨 연결·History와 함께 지운다', () => {
    const { repos } = ctx
    seedBlock(repos, 'old')
    seedElement(repos, 'old-e', 'old', 'task', 0)
    repos.labels.attach('old', repos.labels.findAll()[0].id, SEED_AT)
    recordHistory('block', 'old')
    recordHistory('element', 'old-e')
    repos.blocks.softDelete('old', 'user', EXPIRED)

    const result = service.purgeExpired()

    expect(result).toMatchObject({ blocks: 1, elements: 1 })
    expect(repos.blocks.findByIdIncludingDeleted('old')).toBeUndefined()
    expect(repos.elements.findByIdIncludingDeleted('old-e')).toBeUndefined()
    expect(repos.labels.findAttachedToBlock('old')).toEqual([])
    expect(historyActions(repos, 'block', 'old')).toEqual([])
    expect(historyActions(repos, 'element', 'old-e')).toEqual([])
  })

  it('이동으로 빈 블록(emptied)도 기간이 지나면 지운다', () => {
    seedBlock(ctx.repos, 'emptied')
    ctx.repos.blocks.softDelete('emptied', 'emptied', EXPIRED)

    expect(service.purgeExpired().blocks).toBe(1)
  })

  it('기간이 지나지 않은 블록은 남긴다', () => {
    seedBlock(ctx.repos, 'recent')
    ctx.repos.blocks.softDelete('recent', 'user', RECENT)

    expect(service.purgeExpired().blocks).toBe(0)
    expect(ctx.repos.blocks.findByIdIncludingDeleted('recent')).toBeDefined()
  })

  it('블록이 살아 있어도 삭제된 지 오래된 요소는 단독으로 지운다', () => {
    const { repos } = ctx
    seedBlock(repos, 'b')
    seedElement(repos, 'keep', 'b', 'task', 0)
    seedElement(repos, 'old', 'b', 'due_date', 1)
    seedElement(repos, 'recent', 'b', 'memo', 2)
    recordHistory('element', 'old')
    repos.elements.softDelete('old', 'discarded', EXPIRED)
    repos.elements.softDelete('recent', 'user', RECENT)

    expect(service.purgeExpired()).toMatchObject({ blocks: 0, elements: 1 })
    expect(repos.elements.findByIdIncludingDeleted('old')).toBeUndefined()
    expect(repos.elements.findByIdIncludingDeleted('recent')).toBeDefined()
    expect(repos.elements.findLiveById('keep')).toBeDefined()
    expect(historyActions(repos, 'element', 'old')).toEqual([])
  })

  it('연결된 요소가 없고 오래된, 처리가 끝난 Capture만 지운다', () => {
    const { repos } = ctx
    seedCapture('old-done', 'done', EXPIRED)
    seedCapture('old-failed', 'failed', EXPIRED)
    seedCapture('old-pending', 'pending', EXPIRED)
    seedCapture('recent-done', 'done', RECENT)
    seedCapture('old-with-element', 'done', EXPIRED)
    seedBlock(repos, 'b')
    repos.elements.insert({
      id: 'e',
      blockId: 'b',
      type: 'task',
      captureId: 'old-with-element',
      orderIndex: 0,
      createdAt: SEED_AT,
      updatedAt: SEED_AT
    })

    expect(service.purgeExpired().captures).toBe(2)
    expect(repos.captures.findById('old-done')).toBeUndefined()
    expect(repos.captures.findById('old-failed')).toBeUndefined()
    expect(repos.captures.findById('old-pending')).toBeDefined()
    expect(repos.captures.findById('recent-done')).toBeDefined()
    expect(repos.captures.findById('old-with-element')).toBeDefined()
  })

  it('요소가 하드 딜리트되어 연결이 끊긴 Capture는 같은 실행에서 함께 지운다', () => {
    const { repos } = ctx
    seedCapture('c', 'done', EXPIRED)
    seedBlock(repos, 'b')
    repos.elements.insert({
      id: 'e',
      blockId: 'b',
      type: 'task',
      captureId: 'c',
      orderIndex: 0,
      createdAt: SEED_AT,
      updatedAt: SEED_AT
    })
    repos.blocks.softDelete('b', 'user', EXPIRED)

    expect(service.purgeExpired()).toEqual({ blocks: 1, elements: 1, captures: 1 })
  })
})
