import { BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import type { Point } from './overlayPosition'

/**
 * 창 만들기. (설계 9.7)
 * 화면 진입점: index.html(스튜디오), overlay.html(캐릭터). 두 창 모두 같은 preload(window.api)를 쓴다.
 */

type RendererPage = 'index' | 'overlay'

/** 캐릭터 창 크기 (가로·세로 같음) */
export const OVERLAY_SIZE = 160

/** 두 창 공통 보안 설정 (설계 11장) */
const webPreferences: Electron.WebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}

export function createStudioWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences
  })

  window.on('ready-to-show', () => window.show())
  denyNewWindows(window)
  loadPage(window, 'index')
  return window
}

/**
 * 캐릭터 창: 투명·테두리 없음·항상 위·작업표시줄에 안 보임·크기 고정.
 * 보일 때 다른 앱의 초점을 뺏지 않는다(showInactive).
 * 사용자가 손잡이로 옮기면 onMoved로 새 위치를 알린다(저장은 부르는 쪽이 한다).
 */
export function createOverlayWindow(
  position: Point,
  onMoved: (position: Point) => void
): BrowserWindow {
  const window = new BrowserWindow({
    width: OVERLAY_SIZE,
    height: OVERLAY_SIZE,
    x: position.x,
    y: position.y,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    webPreferences
  })

  // 일반 창보다 위에 둔다. 'floating'은 다른 앱의 일반 창 위에 머무는 단계다.
  window.setAlwaysOnTop(true, 'floating')
  window.on('ready-to-show', () => window.showInactive())
  // 'moved'는 끌기를 놓았을 때 한 번 온다 (끄는 중에 계속 오는 'move'와 다름)
  window.on('moved', () => {
    const [x, y] = window.getPosition()
    onMoved({ x, y })
  })
  denyNewWindows(window)
  loadPage(window, 'overlay')
  return window
}

/** 개발 모드는 Vite 개발 서버, 배포는 빌드된 파일을 연다 */
function loadPage(window: BrowserWindow, page: RendererPage): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl) {
    window.loadURL(page === 'index' ? devUrl : `${devUrl}/${page}.html`)
  } else {
    window.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}

/**
 * 새 창은 열지 않고, http(s) 링크만 기본 브라우저로 연다.
 * 창 안에서 다른 주소로 넘어가는 것도 막는다(예: 파일·링크를 창에 떨어뜨렸을 때).
 */
function denyNewWindows(window: BrowserWindow): void {
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}
