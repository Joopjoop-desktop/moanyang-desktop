import { createContext, useContext } from 'react'

export type ToastInput = {
  message: string
  /** 알림 안의 버튼. 예: 되돌리기 */
  action?: { label: string; run: () => Promise<unknown> }
}

export type ToastApi = {
  show: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

/** 화면 아래 알림 띄우기. ToastProvider 안에서만 쓴다. */
export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있습니다')
  return toast
}
