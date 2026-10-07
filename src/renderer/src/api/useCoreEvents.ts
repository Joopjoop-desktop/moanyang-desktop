import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { CORE_EVENTS, keysToRefresh } from './events'

/**
 * 코어 이벤트를 듣고 해당 데이터를 다시 불러오게 표시한다. (설계 9.5)
 * 앱 최상단에서 한 번만 쓴다. 화면이 사라지면(핫 리로드, StrictMode 재실행 포함)
 * window.api.on이 돌려준 해제 함수로 구독을 모두 풀어, 구독이 쌓이지 않게 한다.
 */
export function useCoreEvents(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribes = CORE_EVENTS.map((event) =>
      window.api.on(event, () => {
        for (const queryKey of keysToRefresh(event)) {
          void queryClient.invalidateQueries({ queryKey })
        }
      })
    )
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe()
    }
  }, [queryClient])
}
