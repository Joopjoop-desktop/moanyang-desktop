import { app, shell, dialog, ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { DatabaseConnection } from './db/connection'
import { initDatabase } from './db'
import { newId } from './infra/id'
import { nowIso } from './infra/time'
import { ElectronChangeNotifier } from './ipc/electronNotifier'
import { createIpcHandlers } from './ipc/handlers'
import { registerIpcHandlers } from './ipc/register'
import { createServices } from './services'

const APP_USER_MODEL_ID = 'com.joopjoop.desktop'

let database: DatabaseConnection | null = null

function createStudioWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  // 새 창은 열지 않고, http(s) 링크만 기본 브라우저로 연다.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
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

  const services = createServices({
    db: database.db,
    now: nowIso,
    newId,
    notifier: new ElectronChangeNotifier()
  })

  // 보관 기간이 지난 데이터 정리. 실패해도 앱 사용에는 지장이 없으므로 기록만 하고 계속한다.
  // 하드 딜리트는 변경 알림을 보내지 않는다 (설계 9.4)
  try {
    const purged = services.purge.purgeExpired()
    console.log('[db] purged', purged)
  } catch (error) {
    console.error('[db] purge failed', error)
  }

  registerIpcHandlers(ipcMain, createIpcHandlers(services), IPC_CHANNELS)

  createStudioWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-quit', () => {
  database?.close()
  database = null
})
