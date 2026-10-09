import { Menu, nativeImage, Tray } from 'electron'
import trayIconPath from '../../../resources/icon.png?asset'
import { trayMenuItems, type TrayActions } from './trayMenu'

/** 작업표시줄 오른쪽(알림 영역) 아이콘 크기 */
const TRAY_ICON_SIZE = 16

/**
 * 트레이 아이콘과 메뉴. (설계 9.7)
 * 왼쪽 클릭은 스튜디오 열기, 오른쪽 클릭은 메뉴.
 * 돌려준 refresh()를 부르면 "캐릭터 숨기기·보이기" 글자를 지금 상태로 바꾼다.
 * Tray 객체는 부르는 쪽이 계속 들고 있어야 한다(버려지면 아이콘이 사라진다).
 */
export function createTray(
  actions: TrayActions,
  isOverlayVisible: () => boolean
): { tray: Tray; refresh: () => void } {
  const icon = nativeImage
    .createFromPath(trayIconPath)
    .resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE })
  const tray = new Tray(icon)
  tray.setToolTip('줍줍')

  const refresh = (): void => {
    tray.setContextMenu(Menu.buildFromTemplate(trayMenuItems(isOverlayVisible(), actions)))
  }
  tray.on('click', actions.openStudio)
  refresh()
  return { tray, refresh }
}
