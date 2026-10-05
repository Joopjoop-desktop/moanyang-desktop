import { describe, expect, it } from 'vitest'
import { planDeleteElement } from './deletion'
import { makeElement } from './testFactories'

const B = 'block'

describe('planDeleteElement', () => {
  it('요소가 여럿이면 그 요소만 user로 삭제하고 남은 순서를 다시 매긴다', () => {
    const block = {
      blockId: B,
      elements: [
        makeElement('a', 'task', { blockId: B, orderIndex: 0 }),
        makeElement('b', 'memo', { blockId: B, orderIndex: 1 }),
        makeElement('c', 'memo', { blockId: B, orderIndex: 2 })
      ]
    }

    expect(planDeleteElement(block, 'b')).toEqual({
      kind: 'element',
      elementId: 'b',
      deleteReason: 'user',
      order: { blockId: B, elementIds: ['a', 'c'] }
    })
  })

  it('마지막 요소면 요소 대신 블록을 user로 삭제하고 라벨은 유지한다', () => {
    const block = { blockId: B, elements: [makeElement('a', 'task', { blockId: B })] }

    expect(planDeleteElement(block, 'a')).toEqual({
      kind: 'block',
      blockId: B,
      deleteReason: 'user',
      keepLabels: true,
      trigger: { action: 'element.delete', elementId: 'a' }
    })
  })

  it('블록에 없는 요소면 에러를 던진다', () => {
    const block = { blockId: B, elements: [makeElement('a', 'task', { blockId: B })] }

    expect(() => planDeleteElement(block, 'nope')).toThrow()
  })
})
