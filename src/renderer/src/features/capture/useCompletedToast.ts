import { useEffect } from 'react'
import { useToast } from '../toast/toastContext'
import { completedMessage } from './captureRules'

/**
 * 추출이 끝나면 결과를 알림으로 알려준다: "캘린더에 N개 넣었어요. N개는 채워 주세요." (설계 9.6)
 * 앱 최상단에서 한 번만 쓴다. 화면이 사라지면 구독을 푼다.
 * 실패는 먹이 칸 아래에 실패 카드가 나타나므로 따로 알리지 않는다.
 */
export function useCompletedToast(): void {
  const toast = useToast()

  useEffect(
    () =>
      window.api.on('capture:completed', (event) =>
        toast.show({ message: completedMessage(event) })
      ),
    [toast]
  )
}
