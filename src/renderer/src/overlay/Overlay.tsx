import { useState } from 'react'
import type { CaptureMethod } from '@shared/model'
import { unwrap } from '../api/client'
import { messageForError } from '../api/errorMessages'
import { Character } from './Character'
import { checkFeed, readTransfer, type FeedInput } from './feed'
import styles from './Overlay.module.css'
import { useBubble } from './useBubble'

const PASTE_HINT = 'Ctrl+V로 먹이 주기'

/**
 * 캐릭터 창 화면. (설계 9.7)
 * - 캐릭터 몸: 글을 끌어다 놓으면 먹는다(drag). 누르면 붙여넣기 모드가 되고 Ctrl+V로 먹는다(paste)
 * - 아래 손잡이 막대: 잡고 끌면 창이 움직인다. 놓으면 코어가 위치를 저장한다
 * 표정 바꾸기는 7-4에서 붙인다.
 */
export function Overlay(): React.JSX.Element {
  const bubble = useBubble()
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
    <main className={styles.stage}>
      {pasteMode ? (
        <p className={styles.bubble}>{PASTE_HINT}</p>
      ) : (
        bubble.text && <p className={styles.bubble}>{bubble.text}</p>
      )}

      <div
        className={dragOver ? `${styles.body} ${styles.dragOver}` : styles.body}
        onClick={() => setPasteMode(true)}
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
        <Character mood="idle" />
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

      <div className={styles.handle} title="끌어서 옮기기" />
    </main>
  )
}
