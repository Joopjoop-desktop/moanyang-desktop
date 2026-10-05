import { describe, expect, it } from 'vitest'
import { DomainError } from './errors'
import { planMoveToBlock, planReorder, planSplit, type BlockSnapshot } from './moves'
import { makeElement } from './testFactories'
import type { DomainElement } from './types'

const T = 'target'
const S = 'source'

function due(id: string, blockId: string, dateValue: string, orderIndex: number): DomainElement {
  return makeElement(id, 'due_date', { blockId, dateValue, orderIndex })
}

function memo(id: string, blockId: string, orderIndex: number): DomainElement {
  return makeElement(id, 'memo', { blockId, value: id, orderIndex })
}

function block(blockId: string, elements: DomainElement[]): BlockSnapshot {
  return { blockId, elements }
}

function expectDomainError(fn: () => unknown, code: string): void {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(code)
    return
  }
  throw new Error(`DomainError(${code})가 발생하지 않았습니다`)
}

describe('planReorder', () => {
  const b = block(T, [memo('a', T, 0), memo('b', T, 1), memo('c', T, 2)])

  it('요소를 지정한 위치로 옮기고 순서를 다시 매긴다', () => {
    expect(planReorder(b, 'c', 0).orders).toEqual([{ blockId: T, elementIds: ['c', 'a', 'b'] }])
    expect(planReorder(b, 'a', 2).orders).toEqual([{ blockId: T, elementIds: ['b', 'c', 'a'] }])
  })

  it('범위를 넘는 위치는 맨 앞/맨 뒤로 맞춘다', () => {
    expect(planReorder(b, 'b', 99).orders[0].elementIds).toEqual(['a', 'c', 'b'])
    expect(planReorder(b, 'b', -1).orders[0].elementIds).toEqual(['b', 'a', 'c'])
  })

  it('순서만 바꾸고 다른 변경은 없다', () => {
    const plan = planReorder(b, 'c', 0)
    expect(plan.moves).toEqual([])
    expect(plan.discards).toEqual([])
    expect(plan.emptiedBlocks).toEqual([])
  })
})

describe('planMoveToBlock', () => {
  describe('충돌이 없을 때', () => {
    it('요소 하나를 놓은 위치에 끼운다', () => {
      const plan = planMoveToBlock({
        source: block(S, [memo('s1', S, 0), memo('s2', S, 1)]),
        target: block(T, [memo('t1', T, 0), memo('t2', T, 1)]),
        movingIds: ['s2'],
        insertIndex: 1
      })

      expect(plan.moves).toEqual([{ elementId: 's2', toBlockId: T }])
      expect(plan.orders).toEqual([
        { blockId: T, elementIds: ['t1', 's2', 't2'] },
        { blockId: S, elementIds: ['s1'] }
      ])
      expect(plan.emptiedBlocks).toEqual([])
    })

    it('블록 합치기는 대상 블록 맨 뒤에 원래 순서대로 붙인다', () => {
      const plan = planMoveToBlock({
        source: block(S, [memo('s2', S, 1), memo('s1', S, 0)]),
        target: block(T, [memo('t1', T, 0)]),
        movingIds: ['s1', 's2']
      })

      expect(plan.orders).toEqual([{ blockId: T, elementIds: ['t1', 's1', 's2'] }])
    })

    it('원본 블록이 비면 emptied 삭제와 라벨 연결 제거를 결과에 포함한다', () => {
      const plan = planMoveToBlock({
        source: block(S, [memo('s1', S, 0)]),
        target: block(T, [memo('t1', T, 0)]),
        movingIds: ['s1']
      })

      expect(plan.emptiedBlocks).toEqual([
        { blockId: S, deleteReason: 'emptied', detachAllLabels: true }
      ])
    })
  })

  describe('자동 정리', () => {
    it('옮겨온 요소가 모두 기존 값과 같으면 선택 없이 자동 정리한다', () => {
      const plan = planMoveToBlock({
        source: block(S, [due('s-due', S, '2026-10-09', 0)]),
        target: block(T, [due('t-due', T, '2026-10-09', 0)]),
        movingIds: ['s-due']
      })

      expect(plan.discards).toEqual([{ elementId: 's-due', cause: 'auto' }])
      expect(plan.moves).toEqual([])
      expect(plan.orders[0].elementIds).toEqual(['t-due'])
      // 버려진 요소만 있던 원본 블록은 비게 된다
      expect(plan.emptiedBlocks.map((b) => b.blockId)).toEqual([S])
    })

    it('날짜 자동 정리 시 확인된 쪽이 있으면 남는 요소의 확인 필요를 끈다', () => {
      const plan = planMoveToBlock({
        source: block(S, [makeElement('s', 'due_date', { blockId: S, dateValue: '2026-10-09' })]),
        target: block(T, [
          makeElement('t', 'due_date', { blockId: T, dateValue: '2026-10-09', needsConfirm: true })
        ]),
        movingIds: ['s']
      })

      expect(plan.confirms).toEqual(['t'])
    })
  })

  describe('충돌 선택', () => {
    // 대상 [10/9], 옮겨오는 [10/9, 10/10] → 10/9 자동 정리, {t-9, s-10} 충돌 묶음
    const source = block(S, [due('s-9', S, '2026-10-09', 0), due('s-10', S, '2026-10-10', 1)])
    const target = block(T, [due('t-9', T, '2026-10-09', 0)])
    const movingIds = ['s-9', 's-10']

    it('선택한 요소만 남기고 나머지는 버린다', () => {
      const plan = planMoveToBlock({
        source,
        target,
        movingIds,
        selection: { due_date: ['s-10'] }
      })

      expect(plan.discards).toEqual([
        { elementId: 's-9', cause: 'auto' },
        { elementId: 't-9', cause: 'selection' }
      ])
      expect(plan.moves).toEqual([{ elementId: 's-10', toBlockId: T }])
      expect(plan.orders[0].elementIds).toEqual(['s-10'])
    })

    it('둘 다 남길 수 있다', () => {
      const plan = planMoveToBlock({
        source,
        target,
        movingIds,
        selection: { due_date: ['t-9', 's-10'] }
      })

      expect(plan.discards).toEqual([{ elementId: 's-9', cause: 'auto' }])
      expect(plan.orders[0].elementIds).toEqual(['t-9', 's-10'])
    })

    it('자동 정리로 남은 요소가 선택에서 버려지면 확인 필요를 끄지 않는다', () => {
      const plan = planMoveToBlock({
        source: block(S, [due('s-9', S, '2026-10-09', 0), due('s-10', S, '2026-10-10', 1)]),
        target: block(T, [
          makeElement('t-9', 'due_date', { blockId: T, dateValue: '2026-10-09', needsConfirm: true })
        ]),
        movingIds,
        selection: { due_date: ['s-10'] }
      })

      expect(plan.confirms).toEqual([])
    })

    it('선택이 빠진 묶음이 있으면 CONFLICT_SELECTION_MISSING', () => {
      expectDomainError(
        () => planMoveToBlock({ source, target, movingIds }),
        'CONFLICT_SELECTION_MISSING'
      )
    })

    it('하나도 남기지 않으면 CONFLICT_SELECTION_EMPTY', () => {
      expectDomainError(
        () => planMoveToBlock({ source, target, movingIds, selection: { due_date: [] } }),
        'CONFLICT_SELECTION_EMPTY'
      )
    })

    it('묶음에 없는 요소를 고르면 CONFLICT_SELECTION_INVALID', () => {
      // s-9는 자동 정리된 요소라 묶음에 없다
      expectDomainError(
        () => planMoveToBlock({ source, target, movingIds, selection: { due_date: ['s-9'] } }),
        'CONFLICT_SELECTION_INVALID'
      )
    })

    it('충돌이 없는 종류를 선택에 넣으면 CONFLICT_SELECTION_INVALID', () => {
      expectDomainError(
        () =>
          planMoveToBlock({
            source,
            target,
            movingIds,
            selection: { due_date: ['t-9'], task: ['x'] }
          }),
        'CONFLICT_SELECTION_INVALID'
      )
    })
  })

  it('같은 블록 안 이동에 쓰면 에러를 던진다', () => {
    const b = block(T, [memo('a', T, 0)])
    expect(() => planMoveToBlock({ source: b, target: b, movingIds: ['a'] })).toThrow()
  })

  it('원본 블록에 없는 요소를 옮기려 하면 에러를 던진다', () => {
    expect(() =>
      planMoveToBlock({
        source: block(S, [memo('s1', S, 0)]),
        target: block(T, []),
        movingIds: ['nope']
      })
    ).toThrow()
  })
})

describe('planSplit', () => {
  it('요소 하나를 새 블록으로 옮긴다', () => {
    const plan = planSplit({
      source: block(S, [memo('a', S, 0), memo('b', S, 1), memo('c', S, 2)]),
      elementId: 'b',
      newBlockId: 'new'
    })

    expect(plan.createdBlockId).toBe('new')
    expect(plan.moves).toEqual([{ elementId: 'b', toBlockId: 'new' }])
    expect(plan.orders).toEqual([
      { blockId: S, elementIds: ['a', 'c'] },
      { blockId: 'new', elementIds: ['b'] }
    ])
    expect(plan.emptiedBlocks).toEqual([])
  })

  it('요소가 하나뿐인 블록은 나눌 것이 없어 아무것도 바꾸지 않는다', () => {
    const plan = planSplit({ source: block(S, [memo('a', S, 0)]), elementId: 'a', newBlockId: 'new' })

    expect(plan.createdBlockId).toBeNull()
    expect(plan.moves).toEqual([])
    expect(plan.orders).toEqual([])
  })
})
