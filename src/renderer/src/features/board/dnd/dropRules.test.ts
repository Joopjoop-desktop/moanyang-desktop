import { describe, expect, it } from 'vitest'
import { resolveDrop, type ElementDnd } from './dropRules'

function el(elementId: string, blockId: string, index: number, blockSize = 3): ElementDnd {
  return { kind: 'element', elementId, blockId, index, blockSize }
}

describe('놓은 위치 → 동작 (설계 7.1, 9.6)', () => {
  describe('요소를 끌 때', () => {
    it('같은 블록의 다른 요소 위: 그 자리로 순서 바꾸기', () => {
      expect(resolveDrop(el('a', 'b1', 0), el('c', 'b1', 2))).toEqual({
        kind: 'reorder',
        elementId: 'a',
        index: 2
      })
    })

    it('제자리에 놓으면 아무것도 하지 않는다', () => {
      expect(resolveDrop(el('a', 'b1', 1), el('a', 'b1', 1))).toBeNull()
    })

    it('다른 블록의 요소 위: 그 요소 앞으로 이동', () => {
      expect(resolveDrop(el('a', 'b1', 0), el('x', 'b2', 1))).toEqual({
        kind: 'moveElement',
        elementId: 'a',
        targetBlockId: 'b2',
        index: 1
      })
    })

    it('다른 블록의 빈 부분: 맨 뒤로 이동', () => {
      expect(resolveDrop(el('a', 'b1', 0), { kind: 'blockArea', blockId: 'b2' })).toEqual({
        kind: 'moveElement',
        elementId: 'a',
        targetBlockId: 'b2'
      })
    })

    it('자기 블록의 빈 부분: 아무것도 하지 않는다', () => {
      expect(resolveDrop(el('a', 'b1', 0), { kind: 'blockArea', blockId: 'b1' })).toBeNull()
    })

    it('보드 빈 곳: 새 블록으로 분리. 요소가 하나뿐인 블록이면 아무것도 하지 않는다', () => {
      expect(resolveDrop(el('a', 'b1', 0), { kind: 'board' })).toEqual({
        kind: 'split',
        elementId: 'a'
      })
      expect(resolveDrop(el('a', 'b1', 0, 1), { kind: 'board' })).toBeNull()
    })
  })

  describe('블록을 끌 때', () => {
    it('다른 블록이나 그 요소 위: 합치기', () => {
      const block = { kind: 'block' as const, blockId: 'b1' }
      const merge = { kind: 'merge', sourceBlockId: 'b1', targetBlockId: 'b2' }

      expect(resolveDrop(block, { kind: 'blockArea', blockId: 'b2' })).toEqual(merge)
      expect(resolveDrop(block, el('x', 'b2', 0))).toEqual(merge)
    })

    it('자기 자신이나 보드 빈 곳: 아무것도 하지 않는다', () => {
      const block = { kind: 'block' as const, blockId: 'b1' }

      expect(resolveDrop(block, { kind: 'blockArea', blockId: 'b1' })).toBeNull()
      expect(resolveDrop(block, el('a', 'b1', 0))).toBeNull()
      expect(resolveDrop(block, { kind: 'board' })).toBeNull()
    })
  })

  it('놓을 곳이 없으면(예: 왼쪽 탭) 아무것도 하지 않는다', () => {
    expect(resolveDrop(el('a', 'b1', 0), undefined)).toBeNull()
  })
})
