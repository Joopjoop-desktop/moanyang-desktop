import { app, dialog, ipcMain, screen, BrowserWindow } from 'electron'
import { join } from 'path'
import { DEV_IPC_CHANNELS, IPC_CHANNELS } from '@shared/ipc'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import type { DatabaseConnection } from './db/connection'
import { initDatabase } from './db'
import { newId } from './infra/id'
import { nowIso } from './infra/time'
import { ElectronChangeNotifier } from './ipc/electronNotifier'
import { createIpcHandlers } from './ipc/handlers'
import { registerIpcHandlers } from './ipc/register'
import { createServices } from './services'
import type { ServiceDeps } from './services/deps'
import { ExtractionQueue } from './services/extractionQueue'
import { MockExtractor } from './extraction/mockExtractor'
import { createDevIpcHandlers } from './dev/handlers'
import { resolveDataDir } from './db/paths'
import { resolveOverlayPosition } from './os/overlayPosition'
import { QuitGate } from './os/quitGate'
import { SettingsFile } from './os/settingsFile'
import { createTray } from './os/tray'
import { createOverlayWindow, createStudioWindow, OVERLAY_SIZE } from './os/windows'

const SETTINGS_FILE_NAME = 'settings.json'

const APP_USER_MODEL_ID = 'com.joopjoop.desktop'

let database: DatabaseConnection | null = null
let queue: ExtractionQueue | null = null
let studio: BrowserWindow | null = null
let overlay: BrowserWindow | null = null
/** 버려지면 트레이 아이콘이 사라지므로 계속 들고 있는다 */
let tray: ReturnType<typeof createTray> | null = null

/**
 * 처리 중인 먹이가 있으면 종료해도 되는지 묻는다. (설계 8.2)
 * 원문은 메모리에만 있어 종료하면 사라지므로, 다음 실행 때 INTERRUPTED 실패 카드가 된다.
 * @returns 종료해도 되는지
 */
function confirmQuit(): boolean {
  const unfinished = queue?.unfinishedCount() ?? 0
  if (unfinished === 0) return true

  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['종료', '취소'],
    defaultId: 1,
    cancelId: 1,
    title: '줍줍',
    message: `아직 처리 중인 먹이가 ${unfinished}개 있어요.`,
    detail: '지금 종료하면 처리하지 못한 먹이는 다시 먹여 주셔야 해요.'
  })
  return choice === 0
}

/** 창 X는 숨기기, 종료는 before-quit에서 확인 (설계 9.7) */
const quitGate = new QuitGate(confirmQuit)

/** X를 눌러도 닫지 않고 숨긴다. 종료 중이면 그대로 닫혀서 종료를 막지 않는다. */
function hideOnClose(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (!quitGate.shouldHideOnClose()) return
    event.preventDefault()
    window.hide()
  })
}

/** 스튜디오·캐릭터 창과 트레이를 띄운다 (설계 9.7) */
function openWindows(): void {
  studio = createStudioWindow()
  hideOnClose(studio)

  // 캐릭터 창은 지난번 위치에 띄운다. 그 위치가 지금 화면 밖이면 기본 위치로
  const settings = new SettingsFile(join(resolveDataDir(), SETTINGS_FILE_NAME))
  const position = resolveOverlayPosition(
    settings.read().overlay,
    screen.getAllDisplays().map((display) => display.workArea),
    screen.getPrimaryDisplay().workArea,
    OVERLAY_SIZE
  )
  overlay = createOverlayWindow(position, (moved) => settings.update({ overlay: moved }))
  // 캐릭터 창에 초점이 있을 때 Alt+F4를 눌러도 숨기기로 (트레이에서 다시 보이기)
  hideOnClose(overlay)

  tray = createTray(
    { openStudio, toggleOverlay, quit: () => app.quit() },
    () => overlay?.isVisible() ?? false
  )
  // 메뉴 글자(숨기기·보이기)는 캐릭터 창이 실제로 보이거나 숨을 때마다 맞춘다.
  // 트레이는 캐릭터 창이 화면에 뜨기(ready-to-show) 전에 만들어지므로, 처음 뜰 때도 여기서 맞춰진다.
  // ready-to-show는 windows.ts가 먼저 등록한 showInactive 다음에 불려서, 처음 뜬 직후에 한 번 더 맞춘다.
  const refreshTray = (): void => tray?.refresh()
  overlay.on('ready-to-show', refreshTray)
  overlay.on('show', refreshTray)
  overlay.on('hide', refreshTray)
}

/** 스튜디오를 앞으로 가져온다 (캐릭터 더블클릭, 트레이, 설계 9.7) */
function openStudio(): void {
  if (!studio || studio.isDestroyed()) return
  if (studio.isMinimized()) studio.restore()
  studio.show()
  studio.focus()
}

/** 캐릭터 숨기기·보이기 (트레이 메뉴). 보일 때 다른 앱의 초점을 뺏지 않는다. */
function toggleOverlay(): void {
  if (!overlay || overlay.isDestroyed()) return
  if (overlay.isVisible()) overlay.hide()
  else overlay.showInactive()
}

// 앱은 하나만 실행한다. 트레이 앱이 둘 뜨면 헷갈리므로, 두 번째 실행은 기존 스튜디오를 연다.
const isPrimaryInstance = app.requestSingleInstanceLock()
if (!isPrimaryInstance) app.quit()
app.on('second-instance', () => openStudio())

app.whenReady().then(() => {
  if (!isPrimaryInstance) return
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  // 개발 모드에서 F12로 개발자 도구, 배포 빌드에서 새로고침 단축키 무시
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    database = initDatabase()
  } catch (error) {
    // DB 준비에 실패하면 창 없이 멈춰 있지 않도록 알리고 종료한다.
    console.error('[db] init failed', error)
    const detail = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox(
      '줍줍을 시작할 수 없습니다',
      `데이터베이스를 준비하지 못했습니다.\n\n${detail}`
    )
    app.quit()
    return
  }

  const deps: ServiceDeps = {
    db: database.db,
    now: nowIso,
    newId,
    notifier: new ElectronChangeNotifier()
  }
  const services = createServices(deps)

  // 지난 실행에서 처리 중이던 먹이는 원문이 없으므로 실패로 바꾼다. 창이 뜨기 전이라 알리지 않는다.
  // 하드 딜리트보다 먼저 해서, 오래된 먹이도 failed가 된 뒤 정리 대상이 되게 한다 (설계 8.2)
  try {
    const interrupted = services.captures.interruptUnfinished()
    if (interrupted > 0) console.log('[capture] interrupted', interrupted)
  } catch (error) {
    console.error('[capture] interrupt failed', error)
  }

  // 보관 기간이 지난 데이터 정리. 실패해도 앱 사용에는 지장이 없으므로 기록만 하고 계속한다.
  // 하드 딜리트는 변경 알림을 보내지 않는다 (설계 9.4)
  try {
    const purged = services.purge.purgeExpired()
    console.log('[db] purged', purged)
  } catch (error) {
    console.error('[db] purge failed', error)
  }

  // 개발 전용 채널(dev:*)은 개발 빌드에서만 등록한다. preload와 같은 빌드 시점 값을 써서
  // 배포 빌드에서는 이 분기가 통째로 빠진다 (설계 9.1)
  // 10단계 전까지는 배포 빌드도 MockExtractor. 개발 모드는 처리 중 상태가 보이도록 지연을 둔다 (설계 8.8)
  queue = new ExtractionQueue({
    captures: services.captures,
    extractor: new MockExtractor({ delayMs: import.meta.env.DEV ? 1_500 : 0 }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notifier: deps.notifier
  })
  const windows = { openStudio }

  if (import.meta.env.DEV) {
    const handlers = {
      ...createIpcHandlers(services, queue, windows),
      ...createDevIpcHandlers(services, deps)
    }
    registerIpcHandlers(ipcMain, handlers, [...IPC_CHANNELS, ...DEV_IPC_CHANNELS])
  } else {
    registerIpcHandlers(ipcMain, createIpcHandlers(services, queue, windows), IPC_CHANNELS)
  }

  openWindows()
})

// 창을 모두 닫아도 트레이에 남는다. 이 이벤트를 듣지 않으면 Electron이 앱을 끝낸다.
app.on('window-all-closed', () => undefined)

// 트레이 "종료" 등 모든 종료 경로에서 처리 중인 먹이를 확인한다 (설계 8.2, 9.7)
app.on('before-quit', (event) => {
  if (!quitGate.allowQuit()) event.preventDefault()
})

app.on('will-quit', () => {
  database?.close()
  database = null
})
