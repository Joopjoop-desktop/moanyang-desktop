import { useEffect, useState } from 'react'
import type { CaptureMethod } from '@shared/model'
import { unwrap } from '@renderer/api/client'
import { messageForError } from '@renderer/api/errorMessages'
import {
  NOTICE_MS,
  noticeForCompleted,
  noticeForFailed,
  type DrawerNotice
} from '@renderer/features/today/lib/drawerStatus'
import { checkFeed, type FeedInput } from '@renderer/features/today/lib/feed'

export type DrawerFeed = {
  /** 떠 있는 알림 (3초) */
  notice: DrawerNotice | null
  /** 미완료 먹이 수 */
  unfinished: number
  /** 놓거나 붙여넣은 것을 먹인다. 글이 아니거나 너무 길면 알림만 띄운다 */
  feed: (input: FeedInput, method: CaptureMethod) => void
}

/**
 * 서랍의 먹이 주기와 상태. (설계 9.4, 9.7)
 * - 처음 뜰 때 미완료 수를 한 번 조회하고, 이후 capture:unfinishedChanged로 갱신한다
 * - 추출 결과(capture:completed / failed)는 3초 동안 알림으로 보여준다
 * 화면이 사라지면 구독을 모두 푼다.
 */
export function useDrawer(): DrawerFeed {
  const [unfinished, setUnfinished] = useState(0)
  const [notice, setNotice] = useState<DrawerNotice | null>(null)

  useEffect(() => {
    let active = true
    // 조회 응답보다 변경 이벤트가 먼저 오면 이벤트 값이 더 새롭다
    let changedMeanwhile = false
    unwrap(window.api.capture.unfinishedCount())
      .then(({ count }) => {
        if (active && !changedMeanwhile) setUnfinished(count)
      })
      .catch((error: unknown) => console.error('[drawer] 미완료 수 조회 실패', error))

    const unsubscribes = [
      window.api.on('capture:unfinishedChanged', ({ count }) => {
        changedMeanwhile = true
        setUnfinished(count)
      }),
      window.api.on('capture:completed', (event) => setNotice(noticeForCompleted(event))),
      window.api.on('capture:failed', (event) => setNotice(noticeForFailed(event)))
    ]
    return () => {
      active = false
      for (const unsubscribe of unsubscribes) unsubscribe()
    }
  }, [])

  // 새 알림이 오면 시간을 다시 센다
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const feed = (input: FeedInput, method: CaptureMethod): void => {
    const check = checkFeed(input)
    if (!check.ok) return setNotice({ tone: 'failed', message: check.message })
    // 받으면 미완료 수가 바뀌어 "정리하는 중…"이 뜬다
    unwrap(window.api.capture.submit({ text: check.text, method })).catch((error: unknown) =>
      setNotice({ tone: 'failed', message: messageForError(error) })
    )
  }

  return { notice, unfinished, feed }
}
