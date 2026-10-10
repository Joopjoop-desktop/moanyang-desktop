import { useState } from 'react'
import { unwrap } from '../api/client'
import { useBlockList } from '../api/queries'
import styles from './Drawer.module.css'
import { drawerText } from './drawerStatus'
import { readTransfer } from './feed'
import type { DrawerFeed } from './useDrawer'

/**
 * 오늘 창 아래 서랍: 먹이 받는 곳. (설계 9.7)
 * - 다른 앱에서 고른 글을 끌어다 놓으면 먹인다(drag). 글을 끌고 오면 열리듯 커진다
 * - 누르면 Ctrl+V를 기다리고, 붙여넣으면 먹인다(paste). 클립보드는 붙여넣는 순간의 글만 받는다
 * - "채워 주세요 N"을 누르면 스튜디오를 연다. 먹이가 끝나도 스튜디오를 저절로 띄우지 않는다
 */
export function Drawer({ drawer }: { drawer: DrawerFeed }): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const { data: needsInput } = useBlockList('needsInput')
  const { text, tone } = drawerText({ ...drawer, dragOver, pasteMode })

  const classNames = [
    styles.drawer,
    dragOver ? styles.open : '',
    pasteMode ? styles.waiting : '',
    tone ? styles[tone] : ''
  ].join(' ')

  return (
    <footer className={styles.footer}>
      <div
        className={classNames}
        role="button"
        tabIndex={0}
        aria-label="서랍: 글을 끌어다 놓거나 눌러서 Ctrl+V"
        onClick={() => setPasteMode(true)}
        // 놓기를 허락하려면 dragover의 기본 동작을 막아야 한다
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDragEnter={() => setDragOver(true)}
        onDragLeave={(event) => {
          // 안쪽 글자(자식 요소) 위로 옮겨 갈 때도 leave가 오므로, 서랍 밖으로 나갔을 때만 끈다
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragOver(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          drawer.feed(readTransfer(event.dataTransfer), 'drag')
        }}
      >
        <span className={styles.icon} aria-hidden>
          ▤
        </span>
        <p className={styles.text}>{text}</p>
        {pasteMode && (
          // 보이지 않는 입력칸에 초점을 줘서 Ctrl+V를 받는다. 다른 곳을 누르면(초점을 잃으면) 끝난다.
          <textarea
            className={styles.pasteCatcher}
            aria-label="Ctrl+V로 넣기"
            autoFocus
            value=""
            onChange={() => undefined}
            onPaste={(event) => {
              event.preventDefault()
              setPasteMode(false)
              drawer.feed(readTransfer(event.clipboardData), 'paste')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setPasteMode(false)
            }}
            onBlur={() => setPasteMode(false)}
          />
        )}
      </div>

      {needsInput && needsInput.length > 0 && (
        <button
          type="button"
          className={styles.fill}
          onClick={() => {
            unwrap(window.api.window.openStudio()).catch((error: unknown) =>
              console.error('[drawer] 스튜디오 열기 실패', error)
            )
          }}
        >
          채워 주세요 <span className={styles.fillCount}>{needsInput.length}</span> →
        </button>
      )}
    </footer>
  )
}
