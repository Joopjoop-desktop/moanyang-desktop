import { useCoreEvents } from './api/useCoreEvents'
import { CalendarView } from './features/calendar/CalendarView'
import { CapturePanel } from './features/capture/CapturePanel'
import { useCompletedToast } from './features/capture/useCompletedToast'

/**
 * 스튜디오 창: 탭 없는 한 화면. (설계 9.6)
 * 위 먹이 칸(붙여넣기·실패 카드), 아래 캘린더 + 오른쪽 목록 패널.
 */
function App(): React.JSX.Element {
  useCoreEvents()
  useCompletedToast()

  return (
    <div className="app">
      <header className="app-feed">
        <CapturePanel />
      </header>
      <CalendarView />
    </div>
  )
}

export default App
