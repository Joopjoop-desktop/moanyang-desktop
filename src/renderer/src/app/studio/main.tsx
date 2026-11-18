import 'pretendard/dist/web/variable/pretendardvariable.css'
import '@renderer/assets/tokens.css'
import '@renderer/assets/tailwind.css'
import '@renderer/assets/main.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient } from '@renderer/api/queryClient'
import StudioApp from './StudioApp'
import { ToastProvider } from '@renderer/components/toast/ToastProvider'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <StudioApp />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
)
