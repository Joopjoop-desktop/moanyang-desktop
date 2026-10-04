import { mkdirSync } from 'fs'
import { dirname } from 'path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

export type AppDatabase = BetterSQLite3Database

export type DatabaseConnection = {
  db: AppDatabase
  close: () => void
}

/**
 * SQLite DB를 열고 연결 설정을 적용한다. (설계 6.4 SQLite 연결 설정)
 * Electron에 의존하지 않으므로 경로만 넘기면 어디서든 열 수 있다.
 */
export function openDatabase(filePath: string): DatabaseConnection {
  mkdirSync(dirname(filePath), { recursive: true })

  const sqlite = new Database(filePath)
  // 외래 키 검사는 연결마다 초기화되므로 열 때마다 켠다.
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')

  return {
    db: drizzle({ client: sqlite }),
    close: () => sqlite.close()
  }
}
