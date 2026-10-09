import { useCallback, useEffect, useState } from 'react'

/** 잠깐 보여줄 말풍선이 떠 있는 시간 */
const BUBBLE_DURATION_MS = 2_500

export type BubbleApi = {
  /** 지금 보여줄 말. 없으면 null */
  text: string | null
  /** 잠깐 보여주고 저절로 사라진다 */
  say: (text: string) => void
}

/** 캐릭터 말풍선. 새 말이 오면 바꿔 끼우고 시간을 다시 센다. */
export function useBubble(): BubbleApi {
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null)

  const say = useCallback((text: string) => {
    setBubble((current) => ({ text, id: (current?.id ?? 0) + 1 }))
  }, [])

  useEffect(() => {
    if (!bubble) return
    const timer = setTimeout(() => setBubble(null), BUBBLE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [bubble])

  return { text: bubble?.text ?? null, say }
}
