import { describe, expect, it } from 'vitest'
import { defaultOverlayPosition, resolveOverlayPosition, type Rect } from './overlayPosition'

const SIZE = 160
// 1920×1080 모니터, 아래 작업표시줄 40px
const primary: Rect = { x: 0, y: 0, width: 1920, height: 1040 }
// 오른쪽에 붙은 두 번째 모니터
const second: Rect = { x: 1920, y: 0, width: 1280, height: 984 }

describe('캐릭터 창 위치 (설계 9.7)', () => {
  it('기본 위치는 주 모니터 작업 영역 오른쪽 아래', () => {
    expect(defaultOverlayPosition(primary, SIZE)).toEqual({ x: 1736, y: 856 })
  })

  it('저장된 위치가 없으면 기본 위치', () => {
    expect(resolveOverlayPosition(undefined, [primary], primary, SIZE)).toEqual({
      x: 1736,
      y: 856
    })
  })

  it('저장된 위치가 화면 안이면 그대로 쓴다 (두 번째 모니터 포함)', () => {
    expect(resolveOverlayPosition({ x: 100, y: 200 }, [primary], primary, SIZE)).toEqual({
      x: 100,
      y: 200
    })
    expect(resolveOverlayPosition({ x: 2500, y: 300 }, [primary, second], primary, SIZE)).toEqual({
      x: 2500,
      y: 300
    })
  })

  it('가장자리에 반쯤 걸쳐 둔 위치는 그대로 쓴다', () => {
    // 창 가운데(x = -50 + 80 = 30)는 화면 안
    expect(resolveOverlayPosition({ x: -50, y: 500 }, [primary], primary, SIZE)).toEqual({
      x: -50,
      y: 500
    })
  })

  it('두 번째 모니터를 뺐으면 기본 위치로 돌린다', () => {
    expect(resolveOverlayPosition({ x: 2500, y: 300 }, [primary], primary, SIZE)).toEqual({
      x: 1736,
      y: 856
    })
  })

  it('창 가운데가 작업표시줄 위에 있으면 기본 위치로 돌린다', () => {
    // y = 1000 → 가운데 1080은 작업 영역(1040) 밖
    expect(resolveOverlayPosition({ x: 500, y: 1000 }, [primary], primary, SIZE)).toEqual({
      x: 1736,
      y: 856
    })
  })
})
