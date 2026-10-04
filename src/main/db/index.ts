import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { openDatabase, type DatabaseConnection } from './connection'
import { resolveDatabasePath, resolveMigrationsPath } from './paths'
import { ensureSystemLabels } from './systemLabels'

/**
 * 앱 시작 시 DB를 준비한다.
 * 1. DB 열기 (WAL, 외래 키)
 * 2. 미적용 마이그레이션을 순서대로 실행
 * 3. 시스템 라벨 보장
 */
export function initDatabase(): DatabaseConnection {
  const dbPath = resolveDatabasePath()
  const migrationsFolder = resolveMigrationsPath()

  const connection = openDatabase(dbPath)
  try {
    migrate(connection.db, { migrationsFolder })
    ensureSystemLabels(connection.db)
  } catch (error) {
    connection.close()
    throw error
  }

  console.log(`[db] ready: ${dbPath}`)
  console.log(`[db] migrations: ${migrationsFolder}`)
  return connection
}
