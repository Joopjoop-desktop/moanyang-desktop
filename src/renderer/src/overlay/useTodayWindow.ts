import { useEffect, useState } from 'react'
import type { IpcResult } from '@shared/ipc'
import { TODAY_OPACITY_DEFAULT, type TodayWindowState } from '@shared/today'
import { unwrap } from '../api/client'

export type TodayWindowControls = TodayWindowState & {
  /** 슬라이더를 움직이는 동안: 화면에만 바로 반영 */
  previewOpacity: (opacity: number) => void
  /** 슬라이더를 놓았을 때: 코어에 저장 */
  saveOpacity: () => void
  toggleCollapsed: () => void
}

/**
 * 오늘 창 투명도·접힘. (설계 9.7)
 * 처음 뜰 때 today:getState로 저장된 값을 읽는다. 접기는 코어가 창 높이를 바꾼다.
 * 투명도는 화면(CSS)에서 적용하고, 슬라이더를 놓을 때만 저장해 파일 쓰기를 줄인다.
 */
export function useTodayWindow(): TodayWindowControls {
  const [state, setState] = useState<TodayWindowState>({
    opacity: TODAY_OPACITY_DEFAULT,
    collapsed: false
  })

  useEffect(() => {
    let active = true
    unwrap(window.api.today.getState())
      .then((saved) => {
        if (active) setState(saved)
      })
      .catch((error: unknown) => console.error('[today] 상태 조회 실패', error))
    return () => {
      active = false
    }
  }, [])

  const apply = (request: Promise<IpcResult<TodayWindowState>>): void => {
    unwrap(request)
      .then(setState)
      .catch((error: unknown) => console.error('[today] 상태 저장 실패', error))
  }

  return {
    ...state,
    previewOpacity: (opacity) => setState((current) => ({ ...current, opacity })),
    saveOpacity: () => apply(window.api.today.setOpacity({ opacity: state.opacity })),
    toggleCollapsed: () => apply(window.api.today.setCollapsed({ collapsed: !state.collapsed }))
  }
}
