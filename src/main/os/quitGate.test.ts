import { describe, expect, it } from 'vitest'
import { QuitGate } from './quitGate'

describe('종료 흐름 (설계 9.7)', () => {
  it('평소에는 창을 닫으면 숨긴다', () => {
    const gate = new QuitGate(() => true)

    expect(gate.shouldHideOnClose()).toBe(true)
  })

  it('종료를 확인받으면 종료 중이 되어 창을 숨기지 않고 닫는다', () => {
    const gate = new QuitGate(() => true)

    expect(gate.allowQuit()).toBe(true)
    expect(gate.shouldHideOnClose()).toBe(false)
  })

  it('확인에서 취소하면 종료를 막고, 창은 계속 숨기기로 동작한다', () => {
    const gate = new QuitGate(() => false)

    expect(gate.allowQuit()).toBe(false)
    expect(gate.shouldHideOnClose()).toBe(true)
  })

  it('종료 중에 before-quit이 다시 와도 다시 묻지 않는다', () => {
    let asked = 0
    const gate = new QuitGate(() => {
      asked += 1
      return true
    })

    gate.allowQuit()
    gate.allowQuit()

    expect(asked).toBe(1)
  })

  it('취소한 뒤 다시 종료하면 다시 묻는다', () => {
    const answers = [false, true]
    const gate = new QuitGate(() => answers.shift() ?? true)

    expect(gate.allowQuit()).toBe(false)
    expect(gate.allowQuit()).toBe(true)
    expect(gate.shouldHideOnClose()).toBe(false)
  })
})
