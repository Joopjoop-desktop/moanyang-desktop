import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LabelView } from '@shared/views'
import { LabelService } from './labelService'
import {
  SEED_AT,
  expectDomainError,
  historyActions,
  seedBlock,
  setupServiceTest,
  type ServiceTestContext
} from './testSupport'

describe('LabelService', () => {
  let ctx: ServiceTestContext
  let service: LabelService
  let coordinating: LabelView
  let waitingReply: LabelView

  beforeEach(() => {
    ctx = setupServiceTest()
    service = new LabelService(ctx.deps)
    seedBlock(ctx.repos, 'b')

    const labels = service.list()
    const byKey = (key: string): LabelView => {
      const label = labels.find((l) => l.key === key)
      if (!label) throw new Error(`시스템 라벨이 없습니다: ${key}`)
      return label
    }
    coordinating = byKey('coordinating')
    waitingReply = byKey('waiting_reply')
  })

  afterEach(() => {
    ctx.connection.close()
  })

  it('시스템 라벨 목록을 돌려준다', () => {
    expect(
      service
        .list()
        .map((l) => l.name)
        .sort()
    ).toEqual(['조율 중', '회신 대기'].sort())
  })

  it('라벨을 붙이고 label.attached를 블록 History에 남긴다', () => {
    const attached = service.attach('b', waitingReply.id)

    expect(attached.map((l) => l.id)).toEqual([waitingReply.id])
    expect(ctx.repos.history.findByEntity('block', 'b')).toMatchObject([
      { action: 'label.attached', after: { labelId: waitingReply.id } }
    ])
    expect(ctx.repos.blocks.findLiveById('b')?.updatedAt).not.toBe(SEED_AT)
  })

  it('같은 그룹 라벨을 붙이면 기존 라벨을 떼고 붙인다', () => {
    service.attach('b', coordinating.id)

    const attached = service.attach('b', waitingReply.id)

    expect(attached.map((l) => l.id)).toEqual([waitingReply.id])
    expect(historyActions(ctx.repos, 'block', 'b')).toEqual([
      'label.attached',
      'label.detached',
      'label.attached'
    ])
  })

  it('이미 붙은 라벨을 다시 붙이면 attachedAt이 그대로다', () => {
    const [first] = service.attach('b', waitingReply.id)

    const [again] = service.attach('b', waitingReply.id)

    expect(again.attachedAt).toBe(first.attachedAt)
    expect(historyActions(ctx.repos, 'block', 'b')).toEqual(['label.attached'])
  })

  it('라벨을 떼고, 붙어 있지 않은 라벨을 떼면 아무것도 바꾸지 않는다', () => {
    service.attach('b', waitingReply.id)

    expect(service.detach('b', waitingReply.id)).toEqual([])
    expect(service.detach('b', waitingReply.id)).toEqual([])
    expect(historyActions(ctx.repos, 'block', 'b')).toEqual(['label.attached', 'label.detached'])
  })

  it('없는 라벨은 LABEL_NOT_FOUND, 삭제된 블록은 BLOCK_NOT_FOUND', () => {
    expectDomainError(() => service.attach('b', 'nope'), 'LABEL_NOT_FOUND')

    ctx.repos.blocks.softDelete('b', 'user', SEED_AT)
    expectDomainError(() => service.attach('b', waitingReply.id), 'BLOCK_NOT_FOUND')
  })
})
