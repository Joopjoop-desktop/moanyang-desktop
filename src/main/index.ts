import { app, shell, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { DatabaseConnection } from './db/connection'
import { initDatabase } from './db'

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

  createStudioWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-quit', () => {
  database?.close()
  database = null
})
