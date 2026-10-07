import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CaptureView } from '@shared/captures'
import { unwrap } from '../../api/client'
import { messageForError } from '../../api/errorMessages'
import { useFailedCaptures } from '../../api/queries'
import { queryKeys } from '../../api/queryKeys'
import { formatTimestamp } from '../../lib/display'
import { useToast } from '../toast/toastContext'
import { failedCardMessage, pasteProblem } from './captureRules'
import styles from './CapturePanel.module.css'

/** 검토함 위: 붙여넣기 입력창 + 실패 카드 (설계 9.6) */
export function CapturePanel(): React.JSX.Element {
  return (
    <div className={styles.panel}>
      <PasteBox />
      <FailedCards />
    </div>
  )
}

/** 붙여넣고 "먹이 주기". Ctrl+Enter로도 보낸다. 바로 응답하고 추출은 뒤에서 이어진다 (설계 8.1) */
function PasteBox(): React.JSX.Element {
  const toast = useToast()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (raw: string) => unwrap(window.api.capture.submit({ text: raw, method: 'paste' })),
    onSuccess: () => {
      setText('')
      toast.show({ message: '먹었어요! 정리하고 있어요.' })
    },
    onError: (error) => setProblem(messageForError(error))
  })

  const submit = (): void => {
    const found = pasteProblem(text)
    setProblem(found)
    if (!found) mutation.mutate(text)
  }

  return (
    <div className={styles.paste}>
      <textarea
        className={styles.textarea}
        rows={3}
        placeholder="메시지를 붙여넣고 Ctrl+Enter로 먹이 주기"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <div className={styles.pasteFooter}>
        {problem && <span className={styles.problem}>{problem}</span>}
        <button
          type="button"
          className={styles.primary}
          disabled={mutation.isPending}
          onClick={submit}
        >
          먹이 주기
        </button>
      </div>
    </div>
  )
}

/** 실패 카드 목록. 다시 시도·닫기가 성공하면 목록을 다시 불러온다 (설계 9.5) */
function FailedCards(): React.JSX.Element | null {
  const { data } = useFailedCaptures()
  if (!data || data.length === 0) return null

  return (
    <ul className={styles.failedList}>
      {data.map((capture) => (
        <FailedCard key={capture.id} capture={capture} />
      ))}
    </ul>
  )
}

function FailedCard({ capture }: { capture: CaptureView }): React.JSX.Element {
  const toast = useToast()
  const queryClient = useQueryClient()
  const refresh = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.failedCaptures })
  const onError = (error: unknown): void => toast.show({ message: messageForError(error) })

  const retry = useMutation({
    mutationFn: () => unwrap(window.api.capture.retry({ captureId: capture.id })),
    onSuccess: refresh,
    onError
  })
  const dismiss = useMutation({
    mutationFn: () => unwrap(window.api.capture.dismiss({ captureId: capture.id })),
    onSuccess: refresh,
    onError
  })
  const busy = retry.isPending || dismiss.isPending

  return (
    <li className={styles.failed}>
      <span className={styles.failedTime}>{formatTimestamp(capture.capturedAt)}</span>
      <span className={styles.failedMessage}>{failedCardMessage(capture)}</span>
      {capture.canRetry && (
        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={() => retry.mutate()}
        >
          다시 시도
        </button>
      )}
      <button
        type="button"
        className={styles.secondary}
        disabled={busy}
        onClick={() => dismiss.mutate()}
      >
        닫기
      </button>
    </li>
  )
}
