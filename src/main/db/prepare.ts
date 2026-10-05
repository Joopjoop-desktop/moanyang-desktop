import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { AppDatabase } from './connection'
import { ensureSystemLabels } from './systemLabels'

/**
 * 연 DB를 사용할 수 있는 상태로 만든다. 앱 시작과 테스트가 같은 순서를 쓴다.
 * 1. 미적용 마이그레이션을 순서대로 실행
 * 2. 시스템 라벨 보장
 */
export function prepareDatabase(db: AppDatabase, migrationsFolder: string): void {
  migrate(db, { migrationsFolder })
  ensureSystemLabels(db)
}
