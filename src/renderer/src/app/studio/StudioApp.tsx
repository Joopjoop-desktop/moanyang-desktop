import closeIcon from '@renderer/assets/icons/x-white.svg'
import { unwrap } from '@renderer/api/client'
import { useCoreEvents } from '@renderer/api/useCoreEvents'
import { CalendarView } from '@renderer/features/calendar/components/CalendarView'
import { useCompletedToast } from '@renderer/features/capture/hooks/useCompletedToast'

/**
 * 스튜디오 창: 탭 없는 한 화면. (설계 9.6)
 * 맨 위 검은 줄(끌어서 창 이동, X로 닫기), 아래는 왼쪽 달력 + 오른쪽 패널(먹이 칸 + 목록).
 * 창은 테두리 없는 투명 창이라 둥근 모서리와 배경은 이 화면이 그린다.
 */
function StudioApp(): React.JSX.Element {
  useCoreEvents()
  useCompletedToast()

  return (
    // 맨 위 검은 줄, 아래 달력 + 오른쪽 패널. 창이 투명이라 이 둥근 판만 보인다
    <div className="flex h-full flex-col overflow-hidden rounded-window bg-bg">
      {/* 검은 줄: 빈 곳을 잡고 끌면 창이 움직인다. 버튼은 끌기에서 빼야 눌린다 */}
      <header className="relative flex h-13 shrink-0 items-center justify-center bg-primary text-primary-text select-none app-drag">
        <span className="text-[1.25rem] font-semibold">줍줍</span>
        {/* 창 닫기 = 숨기기. 종료는 트레이 메뉴에서 (설계 9.7) */}
        <button
          type="button"
          className="absolute top-4 right-7 flex size-5 cursor-pointer border-none bg-transparent p-0 app-no-drag [&_img]:size-5"
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

export default StudioApp
