import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ElementService } from './elementService'
import {
  SEED_AT,
  expectDomainError,
  historyActions,
  seedBlock,
  seedElement,
  setupServiceTest,
  type ServiceTestContext
} from './testSupport'

describe('ElementService', () => {
  let ctx: ServiceTestContext
  let service: ElementService

  beforeEach(() => {
    ctx = setupServiceTest()
    service = new ElementService(ctx.deps)
    seedBlock(ctx.repos, 'b')
    seedElement(ctx.repos, 'task', 'b', 'task', 0, { value: '견적서 송부' })
    seedElement(ctx.repos, 'due', 'b', 'due_date', 1, {
      dateValue: '2026-10-09',
      rawText: '다음주 금요일까지',
      needsConfirm: true
    })
  })

  afterEach(() => {
    ctx.connection.close()
  })

  const liveIds = (): string[] => ctx.repos.elements.findLiveByBlock('b').map((e) => e.id)
  const blockUpdatedAt = (): string | undefined => ctx.repos.blocks.findLiveById('b')?.updatedAt

  describe('요소 추가 (설계 7.7)', () => {
    it('메모는 정해진 순서상 맨 뒤에 넣고 element.created를 남긴다', () => {
      const memo = service.create({ blockId: 'b', type: 'memo', value: '  단가 확인 필요 ' })

      expect(memo).toMatchObject({ type: 'memo', value: '단가 확인 필요', orderIndex: 2 })
      expect(liveIds()).toEqual(['task', 'due', memo.id])
      expect(historyActions(ctx.repos, 'element', memo.id)).toEqual(['element.created'])
      expect(blockUpdatedAt()).not.toBe(SEED_AT)
    })

    it('날짜는 정해진 자리에 확인된 값으로 넣고 다른 요소 순서를 다시 매긴다', () => {
      const start = service.create({
        blockId: 'b',
        type: 'start_date',
        dateValue: '2026-10-05',
        timeValue: '09:00'
      })

      expect(start).toMatchObject({
        dateValue: '2026-10-05',
        timeValue: '09:00',
        rawText: null,
        needsConfirm: false,
        orderIndex: 1
      })
      expect(liveIds()).toEqual(['task', start.id, 'due'])
      expect(ctx.repos.elements.findLiveById('due')?.orderIndex).toBe(2)
      expect(ctx.repos.history.findByEntity('element', start.id)).toMatchObject([
        { action: 'element.created', before: null, after: { type: 'start_date', captureId: null } }
      ])
      // 다른 요소 재번호는 기록하지 않는다 (설계 6.2)
      expect(historyActions(ctx.repos, 'element', 'due')).toEqual([])
    })

    it('이미 있는 종류면 ELEMENT_KIND_EXISTS, 아무것도 바꾸지 않는다', () => {
      expectDomainError(
        () => service.create({ blockId: 'b', type: 'task', value: '다른 할 일' }),
        'ELEMENT_KIND_EXISTS'
      )

      expect(liveIds()).toEqual(['task', 'due'])
      expect(blockUpdatedAt()).toBe(SEED_AT)
    })

    it('종류와 값 모양이 맞지 않거나 비어 있으면 ELEMENT_VALUE_INVALID', () => {
      expectDomainError(
        () =>
          service.create({
            blockId: 'b',
            type: 'requester',
            dateValue: '2026-10-05',
            timeValue: null
          }),
        'ELEMENT_VALUE_INVALID'
      )
      expectDomainError(
        () => service.create({ blockId: 'b', type: 'detail', value: '   ' }),
        'ELEMENT_VALUE_INVALID'
      )
      expectDomainError(
        () => service.create({ blockId: 'gone', type: 'memo', value: '메모' }),
        'BLOCK_NOT_FOUND'
      )
    })
  })

  it('텍스트를 고치면 바뀐 필드만 History에 남긴다', () => {
    service.update('task', { value: '견적서 수정본 송부' })

    expect(ctx.repos.history.findByEntity('element', 'task')).toMatchObject([
      {
        action: 'element.updated',
        before: { value: '견적서 송부' },
        after: { value: '견적서 수정본 송부' }
      }
    ])
    expect(blockUpdatedAt()).not.toBe(SEED_AT)
  })

  it('날짜를 고치면 원래 표현을 비우고 확인 필요를 끈다', () => {
    const updated = service.update('due', { dateValue: '2026-10-12', timeValue: null })

    expect(updated).toMatchObject({ dateValue: '2026-10-12', rawText: null, needsConfirm: false })
    expect(ctx.repos.history.findByEntity('element', 'due')[0]).toMatchObject({
      before: { dateValue: '2026-10-09', rawText: '다음주 금요일까지', needsConfirm: true },
      after: { dateValue: '2026-10-12', rawText: null, needsConfirm: false }
    })
  })

  it('값이 그대로면 아무것도 바꾸지 않는다', () => {
    service.update('task', { value: ' 견적서 송부 ' })

    expect(historyActions(ctx.repos, 'element', 'task')).toEqual([])
    expect(blockUpdatedAt()).toBe(SEED_AT)
  })

  it('확인을 누르면 확인 필요만 끈다', () => {
    const confirmed = service.confirm('due')

    expect(confirmed).toMatchObject({ needsConfirm: false, rawText: '다음주 금요일까지' })
    expect(historyActions(ctx.repos, 'element', 'due')).toEqual(['element.updated'])
  })

  it('요소를 삭제하면 남은 순서를 다시 매기고 element.deleted를 남긴다', () => {
    service.delete('task')

    expect(liveIds()).toEqual(['due'])
    expect(ctx.repos.elements.findLiveById('due')?.orderIndex).toBe(0)
    expect(ctx.repos.elements.findByIdIncludingDeleted('task')?.deleteReason).toBe('user')
    expect(historyActions(ctx.repos, 'element', 'task')).toEqual(['element.deleted'])
  })

  it('마지막 요소를 삭제하면 요소 대신 블록을 user로 삭제하고 block.deleted만 남긴다', () => {
    const label = ctx.repos.labels.findAll()[0]
    ctx.repos.labels.attach('b', label.id, SEED_AT)
    service.delete('task')

    service.delete('due')

    // 요소는 삭제 표시 없이 남아 있고, 블록이 휴지통으로 간다
    expect(ctx.repos.elements.findByIdIncludingDeleted('due')?.deletedAt).toBeNull()
    expect(ctx.repos.blocks.findByIdIncludingDeleted('b')?.deleteReason).toBe('user')
    expect(ctx.repos.labels.findAttachedToBlock('b').map((l) => l.id)).toEqual([label.id])
    expect(historyActions(ctx.repos, 'element', 'due')).toEqual([])
    expect(ctx.repos.history.findByEntity('block', 'b')).toMatchObject([
      {
        action: 'block.deleted',
        after: { deleteReason: 'user', trigger: 'element.delete', elementId: 'due' }
      }
    ])
  })

  it('잘못된 값은 ELEMENT_VALUE_INVALID, 없는 요소는 ELEMENT_NOT_FOUND', () => {
    expectDomainError(() => service.update('task', { value: '' }), 'ELEMENT_VALUE_INVALID')
    expectDomainError(() => service.update('nope', { value: 'x' }), 'ELEMENT_NOT_FOUND')
  })
})
