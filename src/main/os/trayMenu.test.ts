import { describe, expect, it } from 'vitest'
import { trayMenuItems, type TrayActions } from './trayMenu'

function recordingActions(): { actions: TrayActions; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    actions: {
      openStudio: () => calls.push('openStudio'),
      toggleOverlay: () => calls.push('toggleOverlay'),
      quit: () => calls.push('quit')
    }
  }
}

function labels(items: ReturnType<typeof trayMenuItems>): string[] {
  return items.map((item) => ('label' in item ? item.label : '---'))
}

describe('트레이 메뉴 (설계 9.7)', () => {
  it('스튜디오 열기 / 캐릭터 숨기기·보이기 / 종료', () => {
    const { actions } = recordingActions()

    expect(labels(trayMenuItems(true, actions))).toEqual([
      '스튜디오 열기',
      '캐릭터 숨기기',
      '---',
      '종료'
    ])
    expect(labels(trayMenuItems(false, actions))[1]).toBe('캐릭터 보이기')
  })

  it('항목을 누르면 맞는 동작을 부른다', () => {
    const { actions, calls } = recordingActions()

    for (const item of trayMenuItems(true, actions)) {
      if ('click' in item) item.click()
    }

    expect(calls).toEqual(['openStudio', 'toggleOverlay', 'quit'])
  })
})
