import closeIcon from './assets/icons/x-white.svg'
import { unwrap } from './api/client'
import { useCoreEvents } from './api/useCoreEvents'
import { CalendarView } from './features/calendar/CalendarView'
import { useCompletedToast } from './features/capture/useCompletedToast'

/**
 * 스튜디오 창: 탭 없는 한 화면. (설계 9.6)
 * 맨 위 검은 줄(끌어서 창 이동, X로 닫기), 아래는 왼쪽 달력 + 오른쪽 패널(먹이 칸 + 목록).
 * 창은 테두리 없는 투명 창이라 둥근 모서리와 배경은 이 화면이 그린다.
 */
function App(): React.JSX.Element {
  useCoreEvents()
  useCompletedToast()

  return (
    <div className="app">
      <header className="app-titlebar">
        <span className="app-logo">줍줍</span>
        {/* 창 닫기 = 숨기기. 종료는 트레이 메뉴에서 (설계 9.7) */}
        <button
          type="button"
          className="app-close"
          aria-label="창 닫기"
          onClick={() => {
            unwrap(window.api.window.closeStudio()).catch((error: unknown) =>
              console.error('[studio] 닫기 실패', error)
            )
          }}
        >
          <img src={closeIcon} alt="" />
        </button>
      </header>
      <CalendarView />
    </div>
  )
}

export default App
