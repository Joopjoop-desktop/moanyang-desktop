import type { ElementView } from '@shared/views'
import { describeElement, ELEMENT_TYPE_LABELS } from '../../lib/display'
import styles from './ElementRow.module.css'

type Props = {
  element: ElementView
  /** 올해가 아니면 날짜에 연도를 붙이기 위해 */
  currentYear: number
}

/** 요소 한 줄: 종류 이름 + 값 (+ 원래 표현, 확인 필요) */
export function ElementRow({ element, currentYear }: Props): React.JSX.Element {
  const display = describeElement(element, currentYear)
  const emphasized = element.type === 'task'

  return (
    <li className={styles.row}>
      <span className={styles.type}>{ELEMENT_TYPE_LABELS[element.type]}</span>
      <div className={styles.body}>
        <span className={emphasized ? `${styles.value} ${styles.task}` : styles.value}>
          {display.primary}
        </span>
        {display.secondary && <span className={styles.raw}>{display.secondary}</span>}
        {display.needsConfirm && <span className={styles.confirm}>확인 필요</span>}
      </div>
    </li>
  )
}
