import clsx from 'clsx'
import { useState } from 'react'
import { unwrap } from '../api/client'
import { useBlockList } from '../api/queries'
import { drawerText, type NoticeTone } from './drawerStatus'
import { readTransfer } from './feed'
import type { DrawerFeed } from './useDrawer'

/** 결과 알림 (3초) 글자 색 */
const noticeTone: Record<NoticeTone, string> = {
  done: 'text-success',
  empty: 'text-text',
  failed: 'text-warn'
}

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

  const classNames = clsx(
    'relative flex cursor-pointer items-center justify-center rounded-lg border-2 px-8.5 py-3 shadow-panel [transition:min-height_0.15s,border-color_0.15s,background_0.15s] hover:border-border',
    // 글을 끌고 왔을 때: 서랍이 열리듯 커지고 강조
    dragOver ? 'min-h-33 bg-accent-soft' : 'min-h-25 bg-surface',
    // 테두리: 눌러서 Ctrl+V를 기다릴 때 > 글을 끌고 왔을 때 > 없음 (마우스를 올리면 hover가 이긴다)
    pasteMode ? 'border-primary' : dragOver ? 'border-accent' : 'border-transparent'
  )

  return (
    <footer className="flex shrink-0 flex-col gap-2 px-3 pt-0 pb-3">
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
        <p
          className={clsx(
            // 추출 결과 두 문장은 줄을 나눠 보여준다
            'min-w-0 flex-1 text-center text-base/[1.375rem] break-keep whitespace-pre-line',
            tone ? noticeTone[tone] : 'text-gray-60'
          )}
        >
          {text}
        </p>
        {pasteMode && (
          // 보이지 않는 입력칸에 초점을 줘서 Ctrl+V를 받는다. 다른 곳을 누르면(초점을 잃으면) 끝난다.
          <textarea
            className="absolute size-0.25 resize-none opacity-0"
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
          className="inherit-font cursor-pointer self-end rounded border-none bg-transparent px-1.5 py-0.5 text-[0.875rem] text-accent hover:bg-accent-soft"
          onClick={() => {
            unwrap(window.api.window.openStudio()).catch((error: unknown) =>
              console.error('[drawer] 스튜디오 열기 실패', error)
            )
          }}
        >
          채워 주세요 <span className="font-semibold">{needsInput.length}</span> →
        </button>
      )}
    </footer>
  )
}
