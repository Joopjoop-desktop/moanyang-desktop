import '../assets/tokens.css'
import './overlay.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Overlay } from './Overlay'

/** 캐릭터 창 진입점 (overlay.html, 설계 9.7) */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Overlay />
  </StrictMode>
)
