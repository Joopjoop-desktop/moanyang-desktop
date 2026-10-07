import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { messageForError } from '../../api/errorMessages'
import { ToastContext, type ToastApi, type ToastInput } from './toastContext'
import styles from './ToastProvider.module.css'

/** 알림이 떠 있는 시간 */
const TOAST_DURATION_MS = 5_000

type Toast = ToastInput & { id: number }

/**
 * 화면 아래 알림. 한 번에 하나만 보여주고, 새 알림이 오면 바꿔 끼운다. (설계 9.6 되돌리기 알림)
 * 버튼(예: 되돌리기)을 누르면 알림을 닫고 동작을 실행한다. 실패하면 에러 문구로 바꿔 보여준다.
 */
export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toast, setToast] = useState<Toast | null>(null)
  const nextId = useRef(0)

  const show = useCallback((input: ToastInput) => {
    nextId.current += 1
    setToast({ ...input, id: nextId.current })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const runAction = (action: NonNullable<ToastInput['action']>): void => {
    setToast(null)
    action.run().catch((error: unknown) => show({ message: messageForError(error) }))
  }

  const api = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div key={toast.id} className={styles.toast} role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => toast.action && runAction(toast.action)}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}
