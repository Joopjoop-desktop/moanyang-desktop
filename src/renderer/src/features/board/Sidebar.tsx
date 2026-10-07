import type { BlockListFilter } from '@shared/views'
import { useBlockList } from '../../api/queries'
import styles from './Sidebar.module.css'
import { TABS } from './tabs'

type Props = {
  current: BlockListFilter
  onSelect: (filter: BlockListFilter) => void
}

/** 왼쪽 탭. 탭마다 블록 수를 보여준다. */
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
