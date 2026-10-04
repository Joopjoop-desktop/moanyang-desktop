import { app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const DB_FILE_NAME = 'joopjoop.db'
const MIGRATIONS_DIR_NAME = 'drizzle'

/** 개발 모드는 프로젝트의 `data/`, 배포 빌드는 `userData` 경로를 쓴다. (설계 6.4) */
export function resolveDatabasePath(): string {
  const dir = is.dev ? join(app.getAppPath(), 'data') : app.getPath('userData')
  return join(dir, DB_FILE_NAME)
}

/**
 * 마이그레이션 SQL 폴더. (설계 3.1)
 * 개발 모드는 프로젝트의 `drizzle/`, 배포 빌드는 asar 밖의 `resources/drizzle/`(extraResources).
 */
export function resolveMigrationsPath(): string {
  const base = is.dev ? app.getAppPath() : process.resourcesPath
  return join(base, MIGRATIONS_DIR_NAME)
}
