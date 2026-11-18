import { useState } from 'react'
import { useCalendar } from '../api/queries'
import { useCoreEvents } from '../api/useCoreEvents'
import { Drawer } from './Drawer'
import { TodayHeader } from './TodayHeader'
import { TodayList } from './TodayList'
import { todayRows } from './todayRows'
import { useDrawer } from './useDrawer'
import { useLocalToday } from './useLocalToday'
import { useTodayWindow } from './useTodayWindow'

/**
 * 오늘 창 화면. (설계 9.7)
 * - 머리줄: 끌어서 이동, ⚙ 투명도, 접기·펼치기(접으면 코어가 창 높이를 머리줄 높이로 줄인다).
 *   접혀 있으면 머리줄 글자 부분에 글을 놓아 먹일 수 있다
 * - 오늘 할 일: calendar:list(오늘~오늘) → todayRows. 블록이 바뀌면 blocks:changed로 다시 불러온다
 * - 아래 서랍: 먹이 받는 곳(끌어다 놓기·붙여넣기), 결과 문구, 채워 주세요 N
 */
export function Overlay(): React.JSX.Element {
  useCoreEvents()
  const today = useLocalToday()
  const controls = useTodayWindow()
  const drawer = useDrawer()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { data, error } = useCalendar(today, today)
  const rows = data ? todayRows(data, today) : undefined
  const remaining = rows?.filter((row) => !row.completed).length ?? 0

  return (
    <main
      // 창은 투명이고, 이 판 하나가 보이는 전부다. 투명도는 --today-opacity로 받고, 마우스를 올리면 진해진다
      // (Figma Sub_Header + Sub_Arcodian Menu)
      className="flex h-full flex-col overflow-hidden rounded-window bg-bg opacity-[var(--today-opacity,0.9)] [transition:opacity_0.15s] hover:opacity-100"
      style={{ '--today-opacity': controls.opacity / 100 } as React.CSSProperties}
    >
      <TodayHeader
        today={today}
        remaining={remaining}
        controls={controls}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        onFeed={(input) => drawer.feed(input, 'drag')}
      />
      {!controls.collapsed && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <TodayList rows={rows} error={error} />
          </div>
          <Drawer drawer={drawer} />
        </>
      )}
    </main>
  )
}
