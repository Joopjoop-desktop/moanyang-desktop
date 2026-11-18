import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { BlockView } from '@shared/views'
import { unwrap } from '@renderer/api/client'
import { messageForError } from '@renderer/api/errorMessages'
import { useBlock } from '@renderer/api/queries'
import { describeElement, ELEMENT_TYPE_LABELS } from '@renderer/lib/display'
import { blockTitle } from '@renderer/features/block/lib/blockTitle'
import { useToast } from '@renderer/components/toast/toastContext'
import {
  currentDate,
  DATE_TYPES,
  initialChoices,
  planDates,
  type CurrentDate,
  type DateChoices,
  type DateRequest
} from '@renderer/features/calendar/lib/datePlan'

/** 놓은 블록과 날짜 칸 */
export type DateDrop = { blockId: string; date: string }

type Props = DateDrop & { onClose: () => void }

/**
 * 날짜 넣기 창. 목록 블록을 달력 칸에 놓으면 뜬다. (설계 9.6)
 * 블록은 놓은 순간의 값을 다시 받아 쓴다(목록이 그사이 바뀌었을 수 있다).
 */
export function DateDropDialog({ blockId, date, onClose }: Props): React.JSX.Element {
  const { data, error } = useBlock(blockId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center rounded-window bg-[rgba(0,0,0,0.3)]">
      <div
        className="flex max-h-[calc(100%-4rem)] w-[min(27.5rem,calc(100%-2rem))] flex-col gap-3 overflow-y-auto rounded-lg bg-surface px-6 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.2)] focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="date-drop-title"
        // 창이 열리면 창에 초점을 둬서 Esc로 바로 닫을 수 있게 한다
        tabIndex={-1}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <h2 id="date-drop-title" className="text-[1rem]">
          날짜 넣기
        </h2>
        {data ? (
          <DateForm block={data} date={date} onClose={onClose} />
        ) : (
          <>
            <p className="text-[0.8125rem] text-muted">
              {error ? messageForError(error) : '불러오는 중…'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="inherit-font cursor-pointer rounded border border-border bg-surface px-3.5 py-1.5 text-text disabled:cursor-default disabled:opacity-40"
                onClick={onClose}
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DateForm({
  block,
  date,
  onClose
}: {
  block: BlockView
  date: string
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const [choices, setChoices] = useState<DateChoices>(() => initialChoices(block, date))
  const plan = planDates(block, choices)

  const mutation = useMutation({
    mutationFn: (requests: DateRequest[]) => applyRequests(requests),
    onSuccess: () => {
      toast.show({ message: '날짜를 넣었어요.' })
      onClose()
    },
    onError: (e) => {
      toast.show({ message: messageForError(e) })
      onClose()
    }
  })

  return (
    <>
      <p className="[word-break:break-word]">{blockTitle(block)}</p>

      <div className="flex flex-col gap-2 rounded border border-border px-3 py-2.5">
        {DATE_TYPES.map((type) => {
          const current = currentDate(block, type)
          const many = current.kind === 'many'
          return (
            <div
              key={type}
              className="grid grid-cols-[4.5rem_auto_1fr] items-center gap-x-2 gap-y-1"
            >
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={choices[type].checked}
                  disabled={many}
                  onChange={(e) =>
                    setChoices({
                      ...choices,
                      [type]: { ...choices[type], checked: e.target.checked }
                    })
                  }
                />
                {ELEMENT_TYPE_LABELS[type]}
              </label>
              <input
                type="date"
                className="inherit-font rounded border border-border px-1.5 py-1"
                value={choices[type].date}
                disabled={many}
                aria-label={ELEMENT_TYPE_LABELS[type]}
                onChange={(e) =>
                  setChoices({
                    ...choices,
                    [type]: { ...choices[type], checked: true, date: e.target.value }
                  })
                }
              />
              <input
                type="time"
                className="inherit-font justify-self-start rounded border border-border px-1.5 py-1"
                value={choices[type].time}
                disabled={many}
                aria-label={`${ELEMENT_TYPE_LABELS[type]} 시간`}
                onChange={(e) =>
                  setChoices({
                    ...choices,
                    [type]: { ...choices[type], checked: true, time: e.target.value }
                  })
                }
              />
              <span className="col-[2/-1] min-w-0 truncate text-[0.75rem] text-muted">
                {many ? '여러 개라 카드에서 고쳐 주세요' : `지금: ${currentText(current)}`}
              </span>
            </div>
          )
        })}
      </div>

      {!plan.ok && plan.reason === 'startAfterDue' && (
        <p className="rounded bg-warn-soft px-2.5 py-1.5 text-[0.8125rem] text-warn">
          시작일이 마감일보다 늦어요.
        </p>
      )}
      {!plan.ok && plan.reason === 'startTimeAfterDue' && (
        <p className="rounded bg-warn-soft px-2.5 py-1.5 text-[0.8125rem] text-warn">
          시작 시각이 마감 시각보다 늦어요.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="inherit-font cursor-pointer rounded border border-border bg-surface px-3.5 py-1.5 text-text disabled:cursor-default disabled:opacity-40"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className="inherit-font cursor-pointer rounded border border-primary bg-primary px-3.5 py-1.5 text-primary-text disabled:cursor-default disabled:opacity-40"
          disabled={mutation.isPending || !plan.ok}
          onClick={() => plan.ok && mutation.mutate(plan.requests)}
        >
          넣기
        </button>
      </div>
    </>
  )
}

/** "10/9(금) 11:00", 원래 표현만 있으면 "다음주쯤", 없으면 "없음" */
function currentText(current: CurrentDate): string {
  if (current.kind !== 'one') return '없음'
  return describeElement(current.element, new Date().getFullYear()).primary
}

/** 시작일 → 마감일 순으로 따로 요청한다 (설계 9.6) */
async function applyRequests(requests: DateRequest[]): Promise<void> {
  for (const request of requests) {
    if (request.kind === 'create') {
      await unwrap(
        window.api.element.create({
          blockId: request.blockId,
          type: request.type,
          dateValue: request.dateValue,
          timeValue: request.timeValue
        })
      )
    } else {
      await unwrap(
        window.api.element.update({
          elementId: request.elementId,
          dateValue: request.dateValue,
          timeValue: request.timeValue
        })
      )
    }
  }
}
