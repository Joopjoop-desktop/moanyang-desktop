import { useState } from 'react'
import type { CaptureMethod } from '@shared/model'
import { unwrap } from '../api/client'
import { messageForError } from '../api/errorMessages'
import { useCalendar } from '../api/queries'
import { useCoreEvents } from '../api/useCoreEvents'
import { Character } from './Character'
import { checkFeed, readTransfer, type FeedInput } from './feed'
import styles from './Overlay.module.css'
import { TodayHeader } from './TodayHeader'
import { TodayList } from './TodayList'
import { todayRows } from './todayRows'
import todayStyles from './TodayWindow.module.css'
import { useBubble } from './useBubble'
import { useCharacterMood } from './useCharacterMood'
import { useLocalToday } from './useLocalToday'
import { useTodayWindow } from './useTodayWindow'

const PASTE_HINT = 'Ctrl+V로 먹이 주기'

/**
 * 오늘 창 화면. (설계 9.7)
 * - 머리줄: 끌어서 이동, ⚙ 투명도, 접기·펼치기(접으면 코어가 창 높이를 머리줄 높이로 줄인다)
 * - 오늘 할 일: calendar:list(오늘~오늘) → todayRows. 블록이 바뀌면 blocks:changed로 다시 불러온다
 * - 아래: 먹이 받는 곳 (서랍으로 바뀌기 전까지 캐릭터)
 */
export function Overlay(): React.JSX.Element {
  useCoreEvents()
  const today = useLocalToday()
  const controls = useTodayWindow()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { data, error } = useCalendar(today, today)
  const rows = data ? todayRows(data, today) : undefined
  const remaining = rows?.filter((row) => !row.completed).length ?? 0

  return (
    <main
      className={todayStyles.window}
      style={{ '--today-opacity': controls.opacity / 100 } as React.CSSProperties}
    >
      <TodayHeader
        today={today}
        remaining={remaining}
        controls={controls}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
      />
      {!controls.collapsed && (
        <>
          <div className={todayStyles.body}>
            <TodayList rows={rows} error={error} />
          </div>
          <CharacterFeed />
        </>
      )}
    </main>
  )
}

/**
 * 먹이 받는 곳: 캐릭터 몸에 글을 끌어다 놓거나(drag), 누른 뒤 Ctrl+V(paste).
 * 두 번 누르면 스튜디오를 연다. 표정은 미완료 먹이 수와 추출 결과로 정한다.
 */
function CharacterFeed(): React.JSX.Element {
  const bubble = useBubble()
  const mood = useCharacterMood(bubble.say)
  const [dragOver, setDragOver] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)

  const feed = (input: FeedInput, method: CaptureMethod): void => {
    const check = checkFeed(input)
    if (!check.ok) return bubble.say(check.message)
    unwrap(window.api.capture.submit({ text: check.text, method }))
      .then(() => bubble.say('냠! 먹었어요'))
      .catch((error: unknown) => bubble.say(messageForError(error)))
  }

  return (
    <div className={styles.stage}>
      {pasteMode ? (
        <p className={styles.bubble}>{PASTE_HINT}</p>
      ) : (
        bubble.text && <p className={styles.bubble}>{bubble.text}</p>
      )}

      <div
        className={dragOver ? `${styles.body} ${styles.dragOver}` : styles.body}
        onClick={() => setPasteMode(true)}
        // 두 번 누르면 클릭도 두 번 와서 붙여넣기 모드가 켜지지만, 스튜디오로 초점이 가면서 바로 꺼진다
        onDoubleClick={() => {
          unwrap(window.api.window.openStudio()).catch((error: unknown) =>
            bubble.say(messageForError(error))
          )
        }}
        // 놓기를 허락하려면 dragover의 기본 동작을 막아야 한다
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDragEnter={() => setDragOver(true)}
        onDragLeave={(event) => {
          // 캐릭터 그림(자식 요소) 위로 옮겨 갈 때도 leave가 오므로, 몸 밖으로 나갔을 때만 끈다
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragOver(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          feed(readTransfer(event.dataTransfer), 'drag')
        }}
      >
        <Character mood={mood} />
      </div>

      {pasteMode && (
        // 보이지 않는 입력칸에 초점을 줘서 Ctrl+V를 받는다. 다른 곳을 누르면(초점을 잃으면) 끝난다.
        <textarea
          className={styles.pasteCatcher}
          aria-label={PASTE_HINT}
          autoFocus
          value=""
          onChange={() => undefined}
          onPaste={(event) => {
            event.preventDefault()
            setPasteMode(false)
            feed(readTransfer(event.clipboardData), 'paste')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPasteMode(false)
          }}
          onBlur={() => setPasteMode(false)}
        />
      )}
    </div>
  )
}
