import { useEffect, useState } from 'react'
import { unwrap } from '../api/client'
import {
  currentMood,
  reactionToCompleted,
  reactionToFailed,
  REACTION_MS,
  type Mood,
  type Reaction
} from './mood'

/**
 * 캐릭터 표정. 코어의 미완료 먹이 수와 추출 결과 이벤트로 정한다. (설계 9.4, 9.7)
 * - 처음 뜰 때 미완료 수를 한 번 조회하고, 이후 capture:unfinishedChanged로 갱신한다
 * - 추출 결과에는 3초 동안 반응하고 onReaction으로 말풍선을 띄운다
 * 화면이 사라지면 구독을 모두 푼다.
 */
export function useCharacterMood(onReaction: (message: string) => void): Mood {
  const [unfinished, setUnfinished] = useState(0)
  const [reaction, setReaction] = useState<Reaction | null>(null)

  useEffect(() => {
    let active = true
    // 조회 응답보다 변경 이벤트가 먼저 오면 이벤트 값이 더 새롭다
    let changedMeanwhile = false
    unwrap(window.api.capture.unfinishedCount())
      .then(({ count }) => {
        if (active && !changedMeanwhile) setUnfinished(count)
      })
      .catch((error: unknown) => console.error('[overlay] 미완료 수 조회 실패', error))

    const react = (next: Reaction): void => {
      setReaction(next)
      onReaction(next.message)
    }
    const unsubscribes = [
      window.api.on('capture:unfinishedChanged', ({ count }) => {
        changedMeanwhile = true
        setUnfinished(count)
      }),
      window.api.on('capture:completed', (event) => react(reactionToCompleted(event))),
      window.api.on('capture:failed', (event) => react(reactionToFailed(event)))
    ]
    return () => {
      active = false
      for (const unsubscribe of unsubscribes) unsubscribe()
    }
  }, [onReaction])

  useEffect(() => {
    if (!reaction) return
    const timer = setTimeout(() => setReaction(null), REACTION_MS)
    return () => clearTimeout(timer)
  }, [reaction])

  return currentMood(unfinished, reaction)
}
