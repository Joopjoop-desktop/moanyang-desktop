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

  it('검토함에 샘플 블록 5개를 만들고 한 번에 알린다', () => {
    const ids = seedSampleBlocks(ctx.deps)

    const inbox = createServices(ctx.deps).blocks.list('inbox')
    expect(ids).toHaveLength(5)
    expect(inbox.map((b) => b.id).sort()).toEqual([...ids].sort())
    expect(ctx.notifier.calls).toEqual([[...ids].sort()])
  })

  it('블록 1과 3을 합치면 마감일·요청자 충돌 선택을 해볼 수 있다', () => {
    const [first, , third] = seedSampleBlocks(ctx.deps)

    const preview = createServices(ctx.deps).moves.previewMergeBlocks(third, first)

    expect(preview.requiresSelection).toBe(true)
    expect(preview.groups.map((g) => g.type)).toEqual(['task', 'due_date', 'requester'])
  })
})
