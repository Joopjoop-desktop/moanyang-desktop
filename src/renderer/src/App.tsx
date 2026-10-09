import { useState } from 'react'
import { useCoreEvents } from './api/useCoreEvents'
import { BlockBoard } from './features/board/BlockBoard'
import { Sidebar } from './features/board/Sidebar'
import type { StudioView } from './features/board/tabs'
import { CalendarView } from './features/calendar/CalendarView'
import { useCompletedToast } from './features/capture/useCompletedToast'

/** 스튜디오 창: 왼쪽 탭 + 오른쪽 블록 보드 또는 캘린더 (설계 9.6, 7.5) */
function App(): React.JSX.Element {
  useCoreEvents()
  useCompletedToast()
  const [view, setView] = useState<StudioView>('inbox')

  return (
    <div className="app">
      <Sidebar current={view} onSelect={setView} />
      {view === 'calendar' ? <CalendarView /> : <BlockBoard filter={view} />}
    </div>
  )
}

export default App
