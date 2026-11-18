import clsx from 'clsx'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { unwrap } from '@renderer/api/client'
import { messageForError } from '@renderer/api/errorMessages'
import { useBlock } from '@renderer/api/queries'
import chevronDown from '@renderer/assets/icons/chevron-down.svg'
import chevronUp from '@renderer/assets/icons/chevron-up.svg'
import { runBlockAction } from '@renderer/features/block/lib/blockActionRules'
import { Checkbox } from '@renderer/components/ui/Checkbox'
import { describeElement, ELEMENT_TYPE_LABELS } from '@renderer/lib/display'
import { TODAY_KIND_LABELS, type TodayRow } from '@renderer/features/today/lib/todayRows'

type Props = {
  rows: TodayRow[] | undefined
  error: Error | null
}

/**
 * 오늘 할 일 목록 (설계 9.7).
 * 체크박스는 블록 완료·완료 취소. 줄을 누르면 요청자·상세 등이 그 자리에서 펼쳐진다(한 번에 하나, 보기 전용).
 * 끝낸 일은 줄을 긋고 아래로 간다(todayRows). 화면 갱신은 blocks:changed가 맡는다.
 */
export function TodayList({ rows, error }: Props): React.JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const check = useMutation({
    mutationFn: (row: TodayRow) =>
      runBlockAction(row.completed ? 'reopen' : 'complete', row.blockId),
    onSuccess: () => setProblem(null),
    onError: (e) => setProblem(messageForError(e))
  })

  if (error) return <p className="p-3 text-[0.875rem] text-muted">{messageForError(error)}</p>
  if (!rows) return <p className="p-3 text-[0.875rem] text-muted">불러오는 중…</p>
  if (rows.length === 0)
    return <p className="p-3 text-[0.875rem] text-muted">오늘은 할 일이 없어요.</p>

  return (
    <>
      {problem && <p className="px-3 pt-3 pb-0 text-[0.875rem] text-warn">{problem}</p>}
      <ul className="flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <li
            key={row.blockId}
            className="overflow-hidden rounded-lg bg-surface shadow-[0_0_10px_2px_rgba(42,42,42,0.1)]"
          >
            <div className="flex items-center gap-3 p-3">
              <Checkbox
                checked={row.completed}
                disabled={check.isPending}
                aria-label={row.completed ? '완료 취소' : '완료'}
                onChange={() => check.mutate(row)}
              />
              <button
                type="button"
                className="inherit-font flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left text-lg/[1.375rem] text-text"
                aria-expanded={openId === row.blockId}
                onClick={() => setOpenId(openId === row.blockId ? null : row.blockId)}
              >
                <span
                  className={clsx(
                    'min-w-0 truncate font-semibold',
                    row.completed ? 'text-gray-50 line-through' : 'text-gray-90'
                  )}
                >
                  {row.title}
                </span>
                {row.time && (
                  <span
                    className={clsx(
                      'shrink-0 font-medium',
                      row.completed ? 'text-gray-50 line-through' : 'text-muted'
                    )}
                  >
                    {row.time}
                  </span>
                )}
                <span className="shrink-0 text-[0.75rem] text-gray-50">
                  {TODAY_KIND_LABELS[row.kind]}
                </span>
                <img
                  className="ml-auto size-5 shrink-0"
                  src={openId === row.blockId ? chevronUp : chevronDown}
                  alt=""
                />
              </button>
            </div>
            {openId === row.blockId && <RowDetail blockId={row.blockId} />}
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * 펼친 줄: 할 일을 뺀 나머지 요소를 보여준다(보기 전용).
 * 고치려면 "스튜디오에서 열기"로 스튜디오 오른쪽 패널에 그 블록 카드를 연다 (설계 9.7).
 */
function RowDetail({ blockId }: { blockId: string }): React.JSX.Element {
  const { data, error } = useBlock(blockId)
  if (error)
    return <p className="px-12 pt-0 pb-4 text-[0.875rem] text-muted">{messageForError(error)}</p>
  if (!data) return <p className="px-12 pt-0 pb-4 text-[0.875rem] text-muted">불러오는 중…</p>

  const currentYear = new Date().getFullYear()
  const details = data.elements.filter((element) => element.type !== 'task')
  const openInStudio = (): void => {
    unwrap(window.api.window.openStudio({ blockId })).catch((e: unknown) =>
      console.error('[today] 스튜디오 열기 실패', e)
    )
  }

  return (
    <div className="flex flex-col gap-2 px-12 pt-0 pb-4 text-base/[1.375rem]">
      {details.length === 0 ? (
        <p className="text-muted">더 적힌 내용이 없어요.</p>
      ) : (
        <dl className="flex flex-col gap-2">
          {details.map((element) => (
            <div key={element.id} className="flex gap-2">
              <dt className="w-[2.9375rem] shrink-0 text-muted">
                {ELEMENT_TYPE_LABELS[element.type]}
              </dt>
              <dd className="min-w-0 font-medium wrap-anywhere text-text">
                {describeElement(element, currentYear).primary}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        className="inherit-font cursor-pointer self-start border-none bg-transparent px-0 py-0.5 text-[0.875rem] text-accent hover:underline"
        onClick={openInStudio}
      >
        스튜디오에서 열기 →
      </button>
    </div>
  )
}
