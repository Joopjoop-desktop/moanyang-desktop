import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import type { CaptureView } from '@shared/captures'
import { unwrap } from '@renderer/api/client'
import { messageForError } from '@renderer/api/errorMessages'
import { useFailedCaptures } from '@renderer/api/queries'
import { queryKeys } from '@renderer/api/queryKeys'
import { formatTimestamp } from '@renderer/lib/display'
import { useToast } from '@renderer/components/toast/toastContext'
import { failedCardMessage, pasteProblem } from '@renderer/lib/captureRules'

/** 스튜디오 오른쪽 패널 맨 위 먹이 칸: 붙여넣기 입력창 + 실패 카드 (설계 9.6) */
export function CapturePanel(): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-col gap-3">
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
    <div className="flex flex-col gap-3 rounded-lg bg-surface px-2.5 pt-8 pb-3 shadow">
      <textarea
        // 비어 있을 때만 안내 글을 가운데에 두고, 붙여넣은 글은 왼쪽부터 보여준다
        className={clsx(
          // 글 아래 선 하나만 있는 입력칸. 쓴 만큼 늘어나고 160px부터 스크롤한다
          'block field-sizing-content max-h-40 min-h-13.5 w-full resize-none rounded-none border-0 border-b border-border bg-transparent px-0 pt-0 pb-[1.9375rem] text-base/[1.375rem] text-text placeholder:text-gray-60 focus:border-b-primary focus:outline-none',
          !text && 'text-center'
        )}
        rows={2}
        placeholder="메시지를 붙여넣고 Ctrl + Enter로 먹이 주기"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <div className="flex items-center justify-end gap-3">
        {problem && <span className="text-[0.75rem] text-warn">{problem}</span>}
        <button
          type="button"
          className="inherit-font cursor-pointer rounded border-none bg-primary px-2 py-1 text-sm/[1.375rem] font-medium text-primary-text disabled:cursor-default disabled:opacity-50"
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
    <ul className="flex list-none flex-col gap-2 p-0">
      {data.map((capture) => (
        <FailedCard key={capture.id} capture={capture} />
      ))}
    </ul>
  )
}

/** 실패 카드의 다시 시도·닫기 버튼 */
const secondaryButton = clsx(
  'inherit-font cursor-pointer rounded border border-border bg-surface px-2.5 py-0.5 text-[0.75rem] text-text disabled:cursor-default disabled:opacity-50'
)

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
    <li className="flex items-center gap-2.5 rounded-lg bg-warn-soft px-3 py-2.5">
      <span className="text-[0.75rem] text-muted">{formatTimestamp(capture.capturedAt)}</span>
      <span className="flex-1 text-warn">{failedCardMessage(capture)}</span>
      {capture.canRetry && (
        <button
          type="button"
          className={secondaryButton}
          disabled={busy}
          onClick={() => retry.mutate()}
        >
          다시 시도
        </button>
      )}
      <button
        type="button"
        className={secondaryButton}
        disabled={busy}
        onClick={() => dismiss.mutate()}
      >
        닫기
      </button>
    </li>
  )
}
