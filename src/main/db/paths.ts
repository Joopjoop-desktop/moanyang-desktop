import { app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const DB_FILE_NAME = 'joopjoop.db'
const MIGRATIONS_DIR_NAME = 'drizzle'

/**
 * 앱 데이터 폴더. 개발 모드는 프로젝트의 `data/`, 배포 빌드는 `userData` 경로를 쓴다. (설계 6.4)
 * DB와 설정 파일(설계 9.7)이 같은 폴더에 있다.
 */
export function resolveDataDir(): string {
  return is.dev ? join(app.getAppPath(), 'data') : app.getPath('userData')
}

export function resolveDatabasePath(): string {
  return join(resolveDataDir(), DB_FILE_NAME)
}

/**
 * 마이그레이션 SQL 폴더. (설계 3.1)
 * 개발 모드는 프로젝트의 `drizzle/`, 배포 빌드는 asar 밖의 `resources/drizzle/`(extraResources).
 */
export function resolveMigrationsPath(): string {
  const base = is.dev ? app.getAppPath() : process.resourcesPath
  return join(base, MIGRATIONS_DIR_NAME)
}
