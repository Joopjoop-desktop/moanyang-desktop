import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServices } from '../services'
import { setupServiceTest, type ServiceTestContext } from '../services/testSupport'
import { seedSampleBlocks } from './seed'

describe('dev:seed 샘플 블록', () => {
  let ctx: ServiceTestContext

  beforeEach(() => {
    ctx = setupServiceTest()
  })

  afterEach(() => {
    ctx.connection.close()
  })

  it('샘플 블록 9개를 만들고 한 번에 알린다', () => {
    const ids = seedSampleBlocks(ctx.deps)

    const all = createServices(ctx.deps).blocks.list('all')
    expect(ids).toHaveLength(9)
    expect(all.map((b) => b.id).sort()).toEqual([...ids].sort())
    expect(ctx.notifier.calls).toEqual([[...ids].sort()])
  })

  it('블록 분류를 모두 볼 수 있게 섞여 있다 (설계 7.6)', () => {
    const ids = seedSampleBlocks(ctx.deps)
    const { blocks } = createServices(ctx.deps)
    /** 1번부터 센 샘플 번호 */
    const numbersOf = (filter: 'needsInput' | 'undated'): number[] =>
      blocks
        .list(filter)
        .map((b) => ids.indexOf(b.id) + 1)
        .sort((a, b) => a - b)

    expect(numbersOf('needsInput')).toEqual([1, 4, 6, 7, 8])
    expect(numbersOf('undated')).toEqual([9])
    expect(blocks.get(ids[0]).missing).toEqual(['dateConfirm'])
    expect(blocks.get(ids[6]).missing).toEqual(['date'])
    expect(blocks.get(ids[7]).missing).toEqual(['task'])
  })

  it('블록 1과 3을 합치면 마감일·요청자 충돌 선택을 해볼 수 있다', () => {
    const [first, , third] = seedSampleBlocks(ctx.deps)

    const preview = createServices(ctx.deps).moves.previewMergeBlocks(third, first)

    expect(preview.requiresSelection).toBe(true)
    expect(preview.groups.map((g) => g.type)).toEqual(['task', 'due_date', 'requester'])
  })
})
