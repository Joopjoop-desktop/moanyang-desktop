import { join } from 'path'
import { IN_MEMORY, openDatabase, type DatabaseConnection } from './connection'
import { prepareDatabase } from './prepare'

/**
 * 테스트 전용: 마이그레이션과 시스템 라벨이 적용된 메모리 DB를 연다. 앱 코드에서 import하지 않는다.
 * 테스트마다 새로 열고, 끝나면 close()한다.
 */
export function createTestDatabase(): DatabaseConnection {
  const connection = openDatabase(IN_MEMORY)
  // Vitest는 프로젝트 루트에서 실행된다
  prepareDatabase(connection.db, join(process.cwd(), 'drizzle'))
  return connection
}
