import { QueryClient } from '@tanstack/react-query'

/**
 * 화면 전체가 함께 쓰는 캐시. (설계 9.5)
 * - 코어 이벤트로만 다시 불러오므로, 시간이 지났다거나 창에 다시 들어왔다고 다시 부르지 않는다.
 * - 실패한 요청은 자동으로 다시 보내지 않는다. 에러 코드는 대부분 다시 보내도 같다.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  })
}
