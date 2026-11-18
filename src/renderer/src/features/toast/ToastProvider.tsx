import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { messageForError } from '../../api/errorMessages'
import { ToastContext, type ToastApi, type ToastInput } from './toastContext'
import { pushToast } from './toastStack'

/** 알림 하나가 떠 있는 시간 */
const TOAST_DURATION_MS = 5_000

type Toast = ToastInput & { id: number }

/**
 * 화면 아래 알림. 여러 개를 쌓고(최대 3개, 새 알림이 아래) 각각 5초 뒤 사라진다.
 * 넘치면 버튼 없는 알림부터 빼서, 되돌리기 알림이 다른 알림에 덮이지 않는다. (설계 9.6, toastStack)
 * 버튼(예: 되돌리기)을 누르면 그 알림만 닫고 동작을 실행한다. 실패하면 에러 문구를 새 알림으로 띄운다.
 */
export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const show = useCallback((input: ToastInput) => {
    nextId.current += 1
    const toast = { ...input, id: nextId.current }
    setToasts((stack) => pushToast(stack, toast))
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((stack) => stack.filter((toast) => toast.id !== id))
  }, [])

  const runAction = (toast: Toast): void => {
    if (!toast.action) return
    dismiss(toast.id)
    toast.action.run().catch((error: unknown) => show({ message: messageForError(error) }))
  }

  const api = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-100 flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onExpire={dismiss}
              onAction={() => runAction(toast)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

type ToastItemProps = {
  toast: Toast
  onExpire: (id: number) => void
  onAction: () => void
}

/** 알림 하나. 처음 뜬 때부터 5초 뒤 스스로 사라진다(다른 알림이 들어와도 시간이 늘지 않음) */
function ToastItem({ toast, onExpire, onAction }: ToastItemProps): React.JSX.Element {
  const { id } = toast
  useEffect(() => {
    const timer = setTimeout(() => onExpire(id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [id, onExpire])

  return (
    <div
      className="pointer-events-auto flex items-center gap-4 rounded-lg bg-text px-4 py-2.5 whitespace-nowrap text-surface shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
      role="status"
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="inherit-font cursor-pointer border-none bg-transparent p-0 font-semibold text-accent-soft hover:underline"
          onClick={onAction}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
