import { describe, expect, it } from 'vitest'
import { CORE_EVENTS, keysToRefresh } from './events'
import { queryKeys } from './queryKeys'

describe('이벤트 → 다시 불러올 데이터 (설계 9.5)', () => {
  it('블록 변경과 추출 완료는 모든 탭의 블록 목록을 다시 불러온다', () => {
    expect(keysToRefresh('blocks:changed')).toEqual([queryKeys.blocks])
    expect(keysToRefresh('capture:completed')).toEqual([queryKeys.blocks])
    // ['blocks']는 탭별 목록 이름표의 앞부분이라 한 번에 다시 불러온다
    expect(queryKeys.blockList('inbox').slice(0, 1)).toEqual([...queryKeys.blocks])
  })

  it('추출 실패는 실패 카드 목록을 다시 불러온다', () => {
    expect(keysToRefresh('capture:failed')).toEqual([queryKeys.failedCaptures])
  })

  it('구독하는 이벤트마다 다시 불러올 데이터가 있다', () => {
    for (const event of CORE_EVENTS) {
      expect(keysToRefresh(event).length, event).toBeGreaterThan(0)
    }
  })
})
