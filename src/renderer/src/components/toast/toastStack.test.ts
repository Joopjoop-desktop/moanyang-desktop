import { describe, expect, it } from 'vitest'
import { pushToast } from './toastStack'

type Item = { id: string; action?: true }

const plain = (id: string): Item => ({ id })
const undo = (id: string): Item => ({ id, action: true })

function pushAll(...items: Item[]): string[] {
  return items.reduce<Item[]>((stack, item) => pushToast(stack, item), []).map((t) => t.id)
}

describe('알림 쌓기 (설계 9.6)', () => {
  it('3개까지는 들어온 순서대로 쌓는다(새 알림이 아래)', () => {
    expect(pushAll(plain('a'), undo('b'), plain('c'))).toEqual(['a', 'b', 'c'])
  })

  it('넘치면 버튼 없는 알림 중 가장 오래된 것부터 뺀다', () => {
    expect(pushAll(undo('del'), plain('a'), plain('b'), plain('c'))).toEqual(['del', 'b', 'c'])
  })

  it('되돌리기 알림은 새 알림에 밀려 사라지지 않는다', () => {
    expect(pushAll(undo('del'), plain('a'), undo('done'), plain('done-msg'))).toEqual([
      'del',
      'done',
      'done-msg'
    ])
  })

  it('먼저 쌓인 알림이 전부 되돌리기면 빼지 않고 잠시 3개를 넘긴다', () => {
    expect(pushAll(undo('a'), undo('b'), undo('c'), plain('d'))).toEqual(['a', 'b', 'c', 'd'])
    expect(pushAll(undo('a'), undo('b'), undo('c'), undo('d'))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('넘긴 상태에서 버튼 없는 알림이 또 오면 그전 버튼 없는 알림을 뺀다', () => {
    expect(pushAll(undo('a'), undo('b'), undo('c'), plain('d'), plain('e'))).toEqual([
      'a',
      'b',
      'c',
      'e'
    ])
  })
})
