import '../assets/tokens.css'
import './overlay.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Overlay } from './Overlay'

// 캐릭터 몸 밖(빈 곳·손잡이)에 파일을 놓으면 브라우저가 그 파일을 열어 화면이 바뀐다. 창 전체에서 막는다.
for (const type of ['dragover', 'drop'] as const) {
  document.addEventListener(type, (event) => event.preventDefault())
}

/** 캐릭터 창 진입점 (overlay.html, 설계 9.7) */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Overlay />
  </StrictMode>
)
