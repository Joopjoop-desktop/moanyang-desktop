import { describe, expect, it } from 'vitest'
import type { ElementType } from '@shared/model'
import { addableTypes, planAddElement } from './elementAdd'
import { DomainError } from './errors'
import { makeElement } from './testFactories'
import type { DomainElement } from './types'

/** 종류 목록을 그 순서대로 요소로 만든다. ID는 종류 이름(같은 종류가 또 있으면 뒤에 숫자) */
function blockOf(...types: ElementType[]): DomainElement[] {
  return types.map((type, orderIndex) => {
    const seen = types.slice(0, orderIndex).filter((t) => t === type).length
    return makeElement(seen === 0 ? type : `${type}${seen + 1}`, type, { orderIndex })
  })
}

function orderAfterAdding(elements: DomainElement[], type: ElementType): string[] {
  return planAddElement({ blockId: 'block', elements }, type, 'NEW').elementIds
}

describe('요소 직접 추가 (설계 7.7)', () => {
  describe('추가할 수 있는 종류', () => {
    it('빈 종류는 모두, 정해진 순서대로', () => {
      expect(addableTypes([])).toEqual([
        'task',
        'detail',
        'start_date',
        'due_date',
        'requester',
        'memo'
      ])
    })

    it('할 일·시작일·마감일·요청자는 이미 있으면 빠지고, 상세·메모는 항상 있다', () => {
      const elements = blockOf('task', 'detail', 'due_date', 'requester', 'memo')

      expect(addableTypes(elements)).toEqual(['detail', 'start_date', 'memo'])
    })

    it('이미 있는 종류를 추가하려 하면 ELEMENT_KIND_EXISTS', () => {
      const elements = blockOf('task', 'due_date')

      expect(() => orderAfterAdding(elements, 'due_date')).toThrowError(DomainError)
      try {
        orderAfterAdding(elements, 'due_date')
      } catch (error) {
        expect((error as DomainError).code).toBe('ELEMENT_KIND_EXISTS')
      }
    })

    it('합치기로 같은 종류가 여러 개 남은 블록도 그 종류는 추가할 수 없다', () => {
      expect(addableTypes(blockOf('task', 'due_date', 'due_date'))).not.toContain('due_date')
    })
  })

  describe('넣는 자리', () => {
    it('앞 종류 중 가장 뒤의 요소 바로 뒤', () => {
      // 마감일은 할 일·상세·시작일 뒤, 요청자 앞
      expect(orderAfterAdding(blockOf('task', 'detail', 'requester'), 'due_date')).toEqual([
        'task',
        'detail',
        'NEW',
        'requester'
      ])
    })

    it('앞 종류가 없으면 맨 앞', () => {
      expect(orderAfterAdding(blockOf('requester', 'memo'), 'task')).toEqual([
        'NEW',
        'requester',
        'memo'
      ])
    })

    it('같은 종류가 있으면 그 마지막 것 뒤 (메모를 또 추가)', () => {
      expect(orderAfterAdding(blockOf('task', 'memo', 'memo'), 'memo')).toEqual([
        'task',
        'memo',
        'memo2',
        'NEW'
      ])
    })

    it('사람이 순서를 바꿔 놓았어도 블록 안에서 가장 뒤의 앞 종류 뒤에 넣는다', () => {
      // 요청자 → 할 일 → 메모 순으로 옮겨 둔 블록에 시작일 추가: 할 일(앞 종류) 바로 뒤
      expect(orderAfterAdding(blockOf('requester', 'task', 'memo'), 'start_date')).toEqual([
        'requester',
        'task',
        'NEW',
        'memo'
      ])
    })

    it('orderIndex 순서로 계산한다 (넘겨받은 배열 순서와 상관없음)', () => {
      const [task, requester] = blockOf('task', 'requester')

      expect(orderAfterAdding([requester, task], 'detail')).toEqual(['task', 'NEW', 'requester'])
    })
  })
})
