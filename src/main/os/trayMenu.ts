/** 트레이 메뉴 동작. 창을 가진 앱 시작 코드가 채운다. */
export type TrayActions = {
  openStudio: () => void
  toggleOverlay: () => void
  quit: () => void
}

export type TrayMenuItem = { label: string; click: () => void } | { type: 'separator' }

/**
 * 트레이 메뉴 항목. (설계 9.7)
 * Electron Menu.buildFromTemplate에 그대로 넘길 수 있는 모양이고, Electron 없이 테스트한다.
 */
export function trayMenuItems(overlayVisible: boolean, actions: TrayActions): TrayMenuItem[] {
  return [
    { label: '스튜디오 열기', click: actions.openStudio },
    { label: overlayVisible ? '캐릭터 숨기기' : '캐릭터 보이기', click: actions.toggleOverlay },
    { type: 'separator' },
    { label: '종료', click: actions.quit }
  ]
}
