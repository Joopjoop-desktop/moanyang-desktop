import type { RunResult } from 'better-sqlite3'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type * as schema from '../db/schema'

/**
 * 저장소가 쿼리를 실행하는 대상. DB 연결과 트랜잭션(tx) 둘 다 이 타입이다.
 * 서비스는 트랜잭션 안에서 tx로 저장소를 만들어 쓴다.
 */
export type DbExecutor = BaseSQLiteDatabase<'sync', RunResult, typeof schema>
