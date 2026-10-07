import { useEffect } from 'react'
import { useToast } from '../toast/toastContext'
import { completedMessage } from './captureRules'

/**
 * 추출이 끝나면 결과를 알림으로 알려준다. 7단계에서 캐릭터 반응이 생기기 전까지의 피드백이다.
 * 어느 탭을 보고 있든 알려주도록 앱 최상단에서 한 번만 쓴다. 화면이 사라지면 구독을 푼다.
 * 실패는 검토함에 실패 카드가 나타나므로 따로 알리지 않는다.
 */
export function useCompletedToast(): void {
  const toast = useToast()

  useEffect(
    () =>
      window.api.on('capture:completed', ({ blockIds }) =>
        toast.show({ message: completedMessage(blockIds.length) })
      ),
    [toast]
  )
}
