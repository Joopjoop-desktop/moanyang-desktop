import { BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

/**
 * 창 만들기. (설계 9.7)
 * 화면 진입점: index.html(스튜디오), overlay.html(캐릭터). 두 창 모두 같은 preload(window.api)를 쓴다.
 */

type RendererPage = 'index' | 'overlay'

/** 캐릭터 창 크기 (가로·세로 같음) */
export const OVERLAY_SIZE = 160
/** 기본 위치: 작업 영역 오른쪽 아래에서 띄우는 간격 */
const OVERLAY_MARGIN = 24

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
 * 보일 때 다른 앱의 초점을 뺏지 않는다(showInactive). 위치 저장은 7-2에서 붙인다.
 */
export function createOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const window = new BrowserWindow({
    width: OVERLAY_SIZE,
    height: OVERLAY_SIZE,
    x: workArea.x + workArea.width - OVERLAY_SIZE - OVERLAY_MARGIN,
    y: workArea.y + workArea.height - OVERLAY_SIZE - OVERLAY_MARGIN,
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

/** 새 창은 열지 않고, http(s) 링크만 기본 브라우저로 연다. */
function denyNewWindows(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}
