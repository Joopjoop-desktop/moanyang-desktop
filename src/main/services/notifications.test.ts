import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inTransaction } from './deps'
import { createServices, type Services } from '.'
import {
  expectDomainError,
  seedBlock,
  seedElement,
  setupServiceTest,
  type ServiceTestContext
} from './testSupport'

/** 변경 알림 (설계 9.4 blocks:changed 발생 규칙) */
describe('변경 알림', () => {
  let ctx: ServiceTestContext
  let services: Services

  beforeEach(() => {
    ctx = setupServiceTest()
    services = createServices(ctx.deps)
    seedBlock(ctx.repos, 'src')
    seedBlock(ctx.repos, 'dst')
    seedElement(ctx.repos, 's-due', 'src', 'due_date', 0, { dateValue: '2026-10-10' })
    seedElement(ctx.repos, 'd-due', 'dst', 'due_date', 0, { dateValue: '2026-10-09' })
    seedElement(ctx.repos, 'd-memo', 'dst', 'memo', 1, { value: '메모' })
  })

  afterEach(() => {
    ctx.connection.close()
  })

  describe('inTransaction', () => {
    it('커밋된 뒤 모인 블록을 한 번에 알린다', () => {
      inTransaction(ctx.deps, (_repos, changes) => {
        changes.add('a')
        changes.add('b')
        changes.add('a')
      })

      expect(ctx.notifier.calls).toEqual([['a', 'b']])
    })

    it('바뀐 블록이 없으면 알리지 않는다', () => {
      inTransaction(ctx.deps, () => undefined)

      expect(ctx.notifier.calls).toEqual([])
    })

    it('트랜잭션이 실패하면 알리지 않는다', () => {
      expect(() =>
        inTransaction(ctx.deps, (_repos, changes) => {
          changes.add('a')
          throw new Error('rollback')
        })
      ).toThrow('rollback')

      expect(ctx.notifier.calls).toEqual([])
    })

    it('알림이 실패해도 결과를 그대로 돌려준다', () => {
      const deps = {
        ...ctx.deps,
        notifier: {
          blocksChanged: (): void => {
            throw new Error('window closed')
          },
          captureCompleted: (): void => undefined,
          captureFailed: (): void => undefined
        }
      }

      const result = inTransaction(deps, (_repos, changes) => {
        changes.add('a')
        return 'done'
      })

      expect(result).toBe('done')
    })
  })

  it('요소를 옮기면 원본·대상 블록을 알린다', () => {
    services.moves.moveElementToBlock({ elementId: 'd-memo', targetBlockId: 'src' })

    expect(ctx.notifier.calls).toEqual([['dst', 'src']])
  })

  it('충돌 선택이 빠져 거부된 이동은 알리지 않는다', () => {
    expectDomainError(
      () => services.moves.mergeBlocks({ sourceBlockId: 'src', targetBlockId: 'dst' }),
      'CONFLICT_SELECTION_MISSING'
    )

    expect(ctx.notifier.calls).toEqual([])
  })

  it('미리보기와 조회는 알리지 않는다', () => {
    services.moves.previewMergeBlocks('src', 'dst')
    services.blocks.list('all')

    expect(ctx.notifier.calls).toEqual([])
  })

  it('이미 그 상태인 변경은 알리지 않는다', () => {
    services.blocks.setReviewed('src', true)
    services.blocks.setReviewed('src', true)
    services.elements.update('d-memo', { value: '메모' })

    expect(ctx.notifier.calls).toEqual([['src']])
  })

  it('요소 수정·라벨 붙이기·블록 삭제를 알린다', () => {
    services.elements.update('d-memo', { value: '새 메모' })
    services.labels.attach('dst', services.labels.list()[0].id)
    services.blocks.delete('src')

    expect(ctx.notifier.calls).toEqual([['dst'], ['dst'], ['src']])
  })

  it('하드 딜리트는 알리지 않는다', () => {
    ctx.repos.blocks.softDelete('src', 'user', '2026-08-01T00:00:00.000Z')

    expect(services.purge.purgeExpired().blocks).toBe(1)
    expect(ctx.notifier.calls).toEqual([])
  })
})
