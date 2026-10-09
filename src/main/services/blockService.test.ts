import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BlockListFilter } from '@shared/views'
import { BlockService } from './blockService'
import {
  SEED_AT,
  expectDomainError,
  historyActions,
  seedBlock,
  seedElement,
  setupServiceTest,
  type ServiceTestContext
} from './testSupport'

describe('BlockService', () => {
  let ctx: ServiceTestContext
  let service: BlockService

  beforeEach(() => {
    ctx = setupServiceTest()
    service = new BlockService(ctx.deps)
  })

  afterEach(() => {
    ctx.connection.close()
  })

  describe('목록 (설계 7.6, 9.3)', () => {
    const ids = (filter: BlockListFilter): string[] =>
      service
        .list(filter)
        .map((b) => b.id)
        .sort()

    /** 할 일만 있는 블록 (날짜 없음) */
    function seedTaskOnly(id: string): void {
      seedBlock(ctx.repos, id)
      seedElement(ctx.repos, `${id}-task`, id, 'task', 0, { value: id })
    }

    it('전체·완료·휴지통은 블록 상태로 나눈다', () => {
      const { repos } = ctx
      for (const id of ['open', 'reviewed', 'done', 'trashed', 'emptied']) seedTaskOnly(id)
      repos.blocks.update('reviewed', { reviewedAt: SEED_AT })
      repos.blocks.update('done', { reviewedAt: SEED_AT, completedAt: SEED_AT })
      repos.blocks.softDelete('trashed', 'user', SEED_AT)
      repos.blocks.softDelete('emptied', 'emptied', SEED_AT)

      expect(ids('all')).toEqual(['done', 'open', 'reviewed'])
      expect(ids('completed')).toEqual(['done'])
      // emptied는 휴지통에 보이지 않는다
      expect(ids('trash')).toEqual(['trashed'])
    })

    it('채워 주세요·날짜 없는 일은 요소와 이대로 두기로 나눈다', () => {
      const { repos } = ctx
      // 할 일 + 날짜: 캘린더에만
      seedTaskOnly('complete')
      seedElement(repos, 'complete-due', 'complete', 'due_date', 1, { dateValue: '2026-10-09' })
      // 할 일만, 이대로 두기 전 → 채워 주세요 / 후 → 날짜 없는 일
      seedTaskOnly('undatedOpen')
      seedTaskOnly('undatedKept')
      repos.blocks.update('undatedKept', { reviewedAt: SEED_AT })
      // 할 일 없음: 이대로 두기 했어도 채워 주세요
      seedBlock(repos, 'noTask')
      seedElement(repos, 'noTask-req', 'noTask', 'requester', 0, { value: '김과장' })
      repos.blocks.update('noTask', { reviewedAt: SEED_AT })
      // 날짜 확인 필요: 이대로 두기 했어도 채워 주세요
      seedTaskOnly('unsure')
      seedElement(repos, 'unsure-due', 'unsure', 'due_date', 1, {
        dateValue: '2026-10-12',
        needsConfirm: true
      })
      repos.blocks.update('unsure', { reviewedAt: SEED_AT })
      // 완료·삭제는 어느 목록에도 없다
      seedTaskOnly('done')
      repos.blocks.update('done', { completedAt: SEED_AT })
      seedTaskOnly('trashed')
      repos.blocks.softDelete('trashed', 'user', SEED_AT)

      expect(ids('needsInput')).toEqual(['noTask', 'undatedOpen', 'unsure'])
      expect(ids('undated')).toEqual(['undatedKept'])
    })

    it('채워 주세요는 최근 블록이 위', () => {
      const { repos } = ctx
      seedTaskOnly('old')
      repos.blocks.insert('new', '2026-10-02T00:00:00.000Z')
      seedElement(repos, 'new-task', 'new', 'task', 0, { value: 'new' })

      expect(service.list('needsInput').map((b) => b.id)).toEqual(['new', 'old'])
    })

    it('블록마다 빠진 것을 담는다', () => {
      seedBlock(ctx.repos, 'b')
      seedElement(ctx.repos, 'r', 'b', 'requester', 0, { value: '김과장' })

      expect(service.get('b').missing).toEqual(['task', 'date'])
      expect(service.list('needsInput')[0].missing).toEqual(['task', 'date'])
    })
  })

  it('검토 완료는 History를 남기고, 이미 그 상태면 아무것도 바꾸지 않는다', () => {
    seedBlock(ctx.repos, 'b')

    const reviewed = service.setReviewed('b', true)
    expect(reviewed.reviewedAt).not.toBeNull()
    expect(reviewed.updatedAt).not.toBe(SEED_AT)

    service.setReviewed('b', true)
    expect(historyActions(ctx.repos, 'block', 'b')).toEqual(['block.reviewed'])

    expect(service.setReviewed('b', false).reviewedAt).toBeNull()
    expect(historyActions(ctx.repos, 'block', 'b')).toEqual(['block.reviewed', 'block.unreviewed'])
  })

  it('완료와 되돌리기', () => {
    seedBlock(ctx.repos, 'b')

    expect(service.setCompleted('b', true).completedAt).not.toBeNull()
    expect(service.setCompleted('b', false).completedAt).toBeNull()
    expect(historyActions(ctx.repos, 'block', 'b')).toEqual(['block.completed', 'block.reopened'])
  })

  it('휴지통으로 보내도 요소와 라벨은 남아 휴지통 목록에 보이고, 복구하면 돌아온다', () => {
    const { repos } = ctx
    seedBlock(repos, 'b')
    seedElement(repos, 'e', 'b', 'task', 0, { value: '견적서' })
    const label = repos.labels.findAll()[0]
    repos.labels.attach('b', label.id, SEED_AT)

    service.delete('b')

    expectDomainError(() => service.get('b'), 'BLOCK_NOT_FOUND')
    const [trashed] = service.list('trash')
    expect(trashed).toMatchObject({ id: 'b', deleteReason: 'user' })
    expect(trashed.elements.map((e) => e.id)).toEqual(['e'])
    expect(trashed.labels.map((l) => l.id)).toEqual([label.id])

    const restored = service.restore('b')
    expect(restored).toMatchObject({ deletedAt: null, deleteReason: null })
    expect(restored.elements.map((e) => e.id)).toEqual(['e'])
    expect(restored.labels.map((l) => l.id)).toEqual([label.id])
    expect(historyActions(repos, 'block', 'b')).toEqual(['block.deleted', 'block.restored'])
  })

  it('이동으로 빈 블록(emptied)은 복구할 수 없다', () => {
    seedBlock(ctx.repos, 'b')
    ctx.repos.blocks.softDelete('b', 'emptied', SEED_AT)

    expectDomainError(() => service.restore('b'), 'BLOCK_NOT_FOUND')
  })
})
