import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { messageForError } from '../api/errorMessages'
import { useBlock } from '../api/queries'
import { runBlockAction } from '../features/board/blockActionRules'
import { describeElement, ELEMENT_TYPE_LABELS } from '../lib/display'
import { TODAY_KIND_LABELS, type TodayRow } from './todayRows'
import styles from './TodayWindow.module.css'

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

  if (error) return <p className={styles.message}>{messageForError(error)}</p>
  if (!rows) return <p className={styles.message}>불러오는 중…</p>
  if (rows.length === 0) return <p className={styles.message}>오늘은 할 일이 없어요.</p>

  return (
    <>
      {problem && <p className={styles.problem}>{problem}</p>}
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.blockId} className={styles.row}>
            <div className={row.completed ? `${styles.line} ${styles.done}` : styles.line}>
              <input
                type="checkbox"
                className={styles.check}
                checked={row.completed}
                disabled={check.isPending}
                aria-label={row.completed ? '완료 취소' : '완료'}
                onChange={() => check.mutate(row)}
              />
              <button
                type="button"
                className={styles.toggle}
                aria-expanded={openId === row.blockId}
                onClick={() => setOpenId(openId === row.blockId ? null : row.blockId)}
              >
                {row.time && <span className={styles.time}>{row.time}</span>}
                <span className={styles.title}>{row.title}</span>
                <span className={styles.kind}>{TODAY_KIND_LABELS[row.kind]}</span>
              </button>
            </div>
            {openId === row.blockId && <RowDetail blockId={row.blockId} />}
          </li>
        ))}
      </ul>
    </>
  )
}

/** 펼친 줄: 할 일을 뺀 나머지 요소를 보여준다(보기 전용) */
function RowDetail({ blockId }: { blockId: string }): React.JSX.Element {
  const { data, error } = useBlock(blockId)
  if (error) return <p className={styles.detailMessage}>{messageForError(error)}</p>
  if (!data) return <p className={styles.detailMessage}>불러오는 중…</p>

  const currentYear = new Date().getFullYear()
  const details = data.elements.filter((element) => element.type !== 'task')
  if (details.length === 0) return <p className={styles.detailMessage}>더 적힌 내용이 없어요.</p>

  return (
    <dl className={styles.detail}>
      {details.map((element) => (
        <div key={element.id} className={styles.detailRow}>
          <dt>{ELEMENT_TYPE_LABELS[element.type]}</dt>
          <dd>{describeElement(element, currentYear).primary}</dd>
        </div>
      ))}
    </dl>
  )
}
