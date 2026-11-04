import 'pretendard/dist/web/variable/pretendardvariable.css'
import '../assets/tokens.css'
import '../assets/tailwind.css'
import './overlay.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient } from '../api/queryClient'
import { Overlay } from './Overlay'

// 먹이 받는 곳 밖에 파일을 놓으면 브라우저가 그 파일을 열어 화면이 바뀐다. 창 전체에서 막는다.
for (const type of ['dragover', 'drop'] as const) {
  document.addEventListener(type, (event) => event.preventDefault())
}

const queryClient = createQueryClient()

/** 오늘 창 진입점 (overlay.html, 설계 9.7). 오늘 할 일을 불러오려고 스튜디오와 같은 데이터 연결을 쓴다 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Overlay />
    </QueryClientProvider>
  </StrictMode>
)
