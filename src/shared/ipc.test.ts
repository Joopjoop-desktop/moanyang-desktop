import { describe, expect, it } from 'vitest'
import { DEV_IPC_CHANNELS, IPC_CHANNELS } from './ipc'

describe('IPC 채널 목록', () => {
  const all = [...IPC_CHANNELS, ...DEV_IPC_CHANNELS]

  it('모든 채널 이름은 도메인:동작 형식이다 (설계 9.1)', () => {
    for (const channel of all) {
      expect(channel).toMatch(/^[a-z]+:[a-zA-Z]+$/)
    }
  })

  it('채널이 중복되지 않는다', () => {
    expect(new Set(all).size).toBe(all.length)
  })

  it('개발 전용 채널은 dev 도메인에만 있다', () => {
    expect(DEV_IPC_CHANNELS.every((c) => c.startsWith('dev:'))).toBe(true)
    expect(IPC_CHANNELS.some((c) => c.startsWith('dev:'))).toBe(false)
  })
})
