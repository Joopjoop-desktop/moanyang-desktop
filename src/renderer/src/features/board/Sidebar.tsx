import type { BlockListFilter } from '@shared/views'
import { useBlockList } from '../../api/queries'
import styles from './Sidebar.module.css'
import { TABS, type StudioView } from './tabs'

type Props = {
  current: StudioView
  onSelect: (view: StudioView) => void
}

/** 왼쪽 탭. 블록 목록 탭은 블록 수를 보여준다. 맨 아래는 캘린더. */
export function Sidebar({ current, onSelect }: Props): React.JSX.Element {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>줍줍</div>
      {TABS.map((tab) => (
        <TabButton
          key={tab.filter}
          filter={tab.filter}
          label={tab.label}
          active={tab.filter === current}
          onSelect={onSelect}
        />
      ))}
      <button
        type="button"
        className={current === 'calendar' ? `${styles.tab} ${styles.active}` : styles.tab}
        onClick={() => onSelect('calendar')}
      >
        <span>캘린더</span>
      </button>
    </nav>
  )
}

function TabButton({
  filter,
  label,
  active,
  onSelect
}: {
  filter: BlockListFilter
  label: string
  active: boolean
  onSelect: (filter: BlockListFilter) => void
}): React.JSX.Element {
  const { data } = useBlockList(filter)

  return (
    <button
      type="button"
      className={active ? `${styles.tab} ${styles.active}` : styles.tab}
      onClick={() => onSelect(filter)}
    >
      <span>{label}</span>
      {data && data.length > 0 && <span className={styles.count}>{data.length}</span>}
    </button>
  )
}
