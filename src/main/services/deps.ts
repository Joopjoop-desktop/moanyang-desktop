import type { AppDatabase } from '../db/connection'
import { createRepositories, type Repositories } from '../repositories'

/** 서비스가 공통으로 받는 의존성. 테스트에서는 시각을 고정한 now를 넘긴다. */
export type ServiceDeps = {
  db: AppDatabase
  /** 저장 형식의 현재 시각 (nowIso) */
  now: () => string
  /** 엔티티 ID 생성 (newId) */
  newId: () => string
}

/**
 * 한 트랜잭션 안에서 저장소를 만들어 작업을 실행한다. (설계 5.2)
 * 작업 중 예외가 나면 그 안의 쓰기가 모두 취소된다.
 * better-sqlite3 트랜잭션은 동기이므로 fn 안에서 await를 쓰지 않는다.
 */
export function inTransaction<T>(deps: ServiceDeps, fn: (repos: Repositories) => T): T {
  return deps.db.transaction((tx) => fn(createRepositories(tx, deps.newId)))
}
