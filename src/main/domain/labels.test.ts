import { describe, expect, it } from 'vitest'
import { planAttachLabel } from './labels'
import type { DomainLabel } from './types'

const coordinating: DomainLabel = { id: 'coordinating', groupKey: 'progress' }
const waitingReply: DomainLabel = { id: 'waiting_reply', groupKey: 'progress' }
const customA: DomainLabel = { id: 'custom-a', groupKey: null }
const customB: DomainLabel = { id: 'custom-b', groupKey: null }

describe('planAttachLabel', () => {
  it('라벨이 없는 블록에는 그냥 붙인다', () => {
    expect(planAttachLabel([], waitingReply)).toEqual({ attach: true, detachLabelIds: [] })
  })

  it('같은 그룹 라벨이 붙어 있으면 떼고 새 라벨을 붙인다', () => {
    expect(planAttachLabel([coordinating], waitingReply)).toEqual({
      attach: true,
      detachLabelIds: ['coordinating']
    })
  })

  it('이미 붙어 있는 라벨을 다시 붙이면 아무것도 바꾸지 않는다', () => {
    expect(planAttachLabel([waitingReply], waitingReply)).toEqual({
      attach: false,
      detachLabelIds: []
    })
  })

  it('다른 그룹 라벨은 건드리지 않는다', () => {
    expect(planAttachLabel([customA], waitingReply)).toEqual({ attach: true, detachLabelIds: [] })
  })

  it('groupKey가 없는 라벨은 다른 라벨에 영향을 주지 않는다', () => {
    expect(planAttachLabel([customA, coordinating], customB)).toEqual({
      attach: true,
      detachLabelIds: []
    })
  })
})
