import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

  it('목록 종류별로 블록을 나눠 돌려준다', () => {
    const { repos } = ctx
    for (const id of ['inbox', 'reviewed', 'done', 'trashed', 'emptied']) {
      seedBlock(repos, id)
      seedElement(repos, `${id}-task`, id, 'task', 0, { value: id })
    }
    repos.blocks.update('reviewed', { reviewedAt: SEED_AT })
    repos.blocks.update('done', { reviewedAt: SEED_AT, completedAt: SEED_AT })
    repos.blocks.softDelete('trashed', 'user', SEED_AT)
    repos.blocks.softDelete('emptied', 'emptied', SEED_AT)

    const ids = (filter: 'inbox' | 'all' | 'completed' | 'trash'): string[] =>
      service
        .list(filter)
        .map((b) => b.id)
        .sort()

    expect(ids('inbox')).toEqual(['inbox'])
    expect(ids('all')).toEqual(['done', 'inbox', 'reviewed'])
    expect(ids('completed')).toEqual(['done'])
    // emptied는 휴지통에 보이지 않는다
    expect(ids('trash')).toEqual(['trashed'])
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
