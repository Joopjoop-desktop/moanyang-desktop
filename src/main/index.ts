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
import { SettingsFile } from './os/settingsFile'
import { createOverlayWindow, createStudioWindow, OVERLAY_SIZE } from './os/windows'

const SETTINGS_FILE_NAME = 'settings.json'

const APP_USER_MODEL_ID = 'com.joopjoop.desktop'

let database: DatabaseConnection | null = null
let queue: ExtractionQueue | null = null
/** 종료를 이미 확인받았으면 다시 묻지 않는다 */
let quitConfirmed = false

/**
 * 처리 중인 먹이가 있으면 종료해도 되는지 묻는다. (설계 8.2)
 * 원문은 메모리에만 있어 종료하면 사라지므로, 다음 실행 때 INTERRUPTED 실패 카드가 된다.
 * @returns 종료해도 되는지
 */
function confirmQuit(parent?: BrowserWindow): boolean {
  if (quitConfirmed) return true
  const unfinished = queue?.unfinishedCount() ?? 0
  if (unfinished === 0) return true

  const options: Electron.MessageBoxSyncOptions = {
    type: 'question',
    buttons: ['종료', '취소'],
    defaultId: 1,
    cancelId: 1,
    title: '줍줍',
    message: `아직 처리 중인 먹이가 ${unfinished}개 있어요.`,
    detail: '지금 종료하면 처리하지 못한 먹이는 다시 먹여 주셔야 해요.'
  }
  const choice = parent
    ? dialog.showMessageBoxSync(parent, options)
    : dialog.showMessageBoxSync(options)
  quitConfirmed = choice === 0
  return quitConfirmed
}

/**
 * 창 띄우기. 지금은 스튜디오를 닫으면 앱을 끝낸다(캐릭터 창만 남지 않게).
 * 트레이가 생기면(7-5) 스튜디오 X는 숨기기로 바뀐다.
 */
function openWindows(): void {
  const studio = createStudioWindow()
  // 창이 먼저 닫힌 뒤 취소하면 창 없이 앱만 남으므로 닫기 전에 묻는다
  studio.on('close', (event) => {
    if (!confirmQuit(studio)) event.preventDefault()
  })
  studio.on('closed', () => app.quit())

  // 캐릭터 창은 지난번 위치에 띄운다. 그 위치가 지금 화면 밖이면 기본 위치로 (설계 9.7)
  const settings = new SettingsFile(join(resolveDataDir(), SETTINGS_FILE_NAME))
  const position = resolveOverlayPosition(
    settings.read().overlay,
    screen.getAllDisplays().map((display) => display.workArea),
    screen.getPrimaryDisplay().workArea,
    OVERLAY_SIZE
  )
  createOverlayWindow(position, (moved) => settings.update({ overlay: moved }))
}

app.whenReady().then(() => {
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
  // 9단계 전까지는 배포 빌드도 MockExtractor. 개발 모드는 처리 중 상태가 보이도록 지연을 둔다 (설계 8.8)
  queue = new ExtractionQueue({
    captures: services.captures,
    extractor: new MockExtractor({ delayMs: import.meta.env.DEV ? 1_500 : 0 }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  if (import.meta.env.DEV) {
    const handlers = {
      ...createIpcHandlers(services, queue),
      ...createDevIpcHandlers(services, deps)
    }
    registerIpcHandlers(ipcMain, handlers, [...IPC_CHANNELS, ...DEV_IPC_CHANNELS])
  } else {
    registerIpcHandlers(ipcMain, createIpcHandlers(services, queue), IPC_CHANNELS)
  }

  openWindows()
})

app.on('window-all-closed', () => {
  app.quit()
})

// 창 닫기 말고 다른 경로로 종료할 때도 확인한다 (예: 7단계 트레이 메뉴)
app.on('before-quit', (event) => {
  if (!confirmQuit()) event.preventDefault()
})

app.on('will-quit', () => {
  database?.close()
  database = null
})
