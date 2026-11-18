import { BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import type { Point } from './overlayPosition'

/**
 * 창 만들기. (설계 9.7)
 * 화면 진입점: index.html(스튜디오), overlay.html(오늘 창). 두 창 모두 같은 preload(window.api)를 쓴다.
 */

type RendererPage = 'index' | 'overlay'

/**
 * 오늘 창: 폭은 고정, 높이는 세로로만 조절 (설계 9.7).
 * Figma Sub_Header(폭 370, 머리줄 60)를 87.5%로 줄인 크기다. 화면 글자 기준(renderer의 today.css 14px)과 같이 움직인다.
 */
export const TODAY_WIDTH = 324
export const TODAY_DEFAULT_HEIGHT = 456
export const TODAY_MIN_HEIGHT = 210
/** 접었을 때 높이 = 화면의 머리줄 높이 (오늘 창 CSS와 같아야 한다) */
export const TODAY_COLLAPSED_HEIGHT = 52

/** 두 창 공통 보안 설정 (설계 11장) */
const webPreferences: Electron.WebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}

/** 스튜디오 창 기본 크기 = Figma 메인 화면(Main2_1·Main2_2) 프레임 */
export const STUDIO_WIDTH = 1336
export const STUDIO_HEIGHT = 824
export const STUDIO_MIN_WIDTH = 1100
export const STUDIO_MIN_HEIGHT = 680

/**
 * 스튜디오 창: 테두리 없는 투명 창. 둥근 모서리와 맨 위 검은 줄(Logo, 닫기 X)은 화면이 그린다.
 * 줄을 잡고 끌면 창이 움직이고, X는 창 닫기(= 숨기기, hideOnClose)다. 둥근 모서리가 잘리지 않게 최대화는 막는다.
 */
export function createStudioWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: STUDIO_WIDTH,
    height: STUDIO_HEIGHT,
    minWidth: STUDIO_MIN_WIDTH,
    minHeight: STUDIO_MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    webPreferences
  })

  window.on('ready-to-show', () => window.show())
  denyNewWindows(window)
  loadPage(window, 'index')
  return window
}

type OverlayCallbacks = {
  /** 머리줄로 옮긴 뒤 새 위치 (저장은 부르는 쪽이 한다) */
  onMoved: (position: Point) => void
  /** 가장자리를 끌어 높이를 바꾼 뒤 새 높이. 접혀 있을 때는 오지 않는다 */
  onResized: (height: number) => void
}

/**
 * 오늘 창: 투명·테두리 없음·항상 위·작업표시줄에 안 보임. 폭 고정, 세로로만 크기 조절.
 * 투명·테두리 없는 창도 Windows에서 가장자리 끌기로 세로 크기 조절이 되는 것을 확인했다 (설계 9.7).
 * 보일 때 다른 앱의 초점을 뺏지 않는다(showInactive).
 */
export function createOverlayWindow(
  position: Point,
  layout: { height: number; collapsed: boolean },
  callbacks: OverlayCallbacks
): BrowserWindow {
  const window = new BrowserWindow({
    width: TODAY_WIDTH,
    height: layout.height,
    x: position.x,
    y: position.y,
    minWidth: TODAY_WIDTH,
    maxWidth: TODAY_WIDTH,
    minHeight: TODAY_MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    webPreferences
  })
  if (layout.collapsed) setOverlayCollapsed(window, true, layout.height)

  // 'resized'는 끌기를 놓았을 때 한 번 온다. 접힌 동안의 크기 변경은 펼친 높이가 아니므로 무시한다
  window.on('resized', () => {
    if (!window.isResizable()) return
    callbacks.onResized(window.getSize()[1])
  })

  // 일반 창보다 위에 둔다. 'floating'은 다른 앱의 일반 창 위에 머무는 단계다.
  window.setAlwaysOnTop(true, 'floating')
  window.on('ready-to-show', () => window.showInactive())
  // 'moved'는 끌기를 놓았을 때 한 번 온다 (끄는 중에 계속 오는 'move'와 다름)
  window.on('moved', () => {
    const [x, y] = window.getPosition()
    callbacks.onMoved({ x, y })
  })
  denyNewWindows(window)
  loadPage(window, 'overlay')
  return window
}

/**
 * 오늘 창 접기·펼치기 (설계 9.7).
 * 투명 부분도 클릭을 막으므로 화면만 접지 않고 창 높이를 머리줄 높이로 줄인다.
 * 접힌 동안은 크기 조절을 끄고, 펼치면 expandedHeight로 돌아간다.
 */
export function setOverlayCollapsed(
  window: BrowserWindow,
  collapsed: boolean,
  expandedHeight: number
): void {
  if (collapsed) {
    window.setResizable(false)
    window.setMinimumSize(TODAY_WIDTH, TODAY_COLLAPSED_HEIGHT)
    window.setSize(TODAY_WIDTH, TODAY_COLLAPSED_HEIGHT)
  } else {
    window.setMinimumSize(TODAY_WIDTH, TODAY_MIN_HEIGHT)
    window.setSize(TODAY_WIDTH, expandedHeight)
    window.setResizable(true)
  }
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
