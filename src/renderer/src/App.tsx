import { useState } from 'react'
import type { BlockListFilter } from '@shared/views'
import { useCoreEvents } from './api/useCoreEvents'
import { BlockBoard } from './features/board/BlockBoard'
import { Sidebar } from './features/board/Sidebar'
import { useCompletedToast } from './features/capture/useCompletedToast'

/** 스튜디오 창: 왼쪽 탭 + 오른쪽 블록 보드 (설계 9.6) */
function App(): React.JSX.Element {
  useCoreEvents()
  useCompletedToast()
  const [filter, setFilter] = useState<BlockListFilter>('inbox')

  return (
    <div className="app">
      <Sidebar current={filter} onSelect={setFilter} />
      <BlockBoard filter={filter} />
    </div>
  )
}

export default App
