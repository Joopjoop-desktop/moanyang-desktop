import { describe, expect, it } from 'vitest'
import { clampOpacity, resolveTodayLayout } from './todayWindowState'

const SIZES = { defaultHeight: 420, minHeight: 160 }

describe('오늘 창 설정 값 (설계 9.7)', () => {
  it('저장된 값이 없으면 기본값: 높이 420, 투명도 90, 펼침', () => {
    expect(resolveTodayLayout(undefined, SIZES)).toEqual({
      height: 420,
      opacity: 90,
      collapsed: false
    })
  })

  it('저장된 값을 쓴다', () => {
    expect(resolveTodayLayout({ height: 600, opacity: 50, collapsed: true }, SIZES)).toEqual({
      height: 600,
      opacity: 50,
      collapsed: true
    })
  })

  it('범위를 벗어난 값은 가까운 값으로 맞춘다', () => {
    expect(resolveTodayLayout({ height: 40, opacity: 5 }, SIZES)).toMatchObject({
      height: 160,
      opacity: 30
    })
    expect(clampOpacity(150)).toBe(100)
    expect(clampOpacity(72.6)).toBe(73)
  })
})
