import type { IpcEvents } from '@shared/ipc'
import type { AppDatabase } from '../db/connection'
import { createRepositories, type Repositories } from '../repositories'

/**
 * 서비스가 데이터 변경을 알리는 통로. (설계 5.2, 9.4)
 * Electron 구현체는 모든 창에 이벤트를 보내고, 테스트는 가짜 구현으로 검증한다.
 */
export interface ChangeNotifier {
  blocksChanged(blockIds: string[]): void
  captureCompleted(payload: IpcEvents['capture:completed']): void
  captureFailed(payload: IpcEvents['capture:failed']): void
  captureUnfinishedChanged(payload: IpcEvents['capture:unfinishedChanged']): void
}

/** 서비스가 공통으로 받는 의존성. 테스트에서는 시각을 고정한 now와 가짜 notifier를 넘긴다. */
export type ServiceDeps = {
  db: AppDatabase
  /** 저장 형식의 현재 시각 (nowIso) */
  now: () => string
  /** 엔티티 ID 생성 (newId) */
  newId: () => string
  notifier: ChangeNotifier
}

/** 트랜잭션 안에서 바뀐 블록 ID를 모은다. 커밋된 뒤에 한 번에 알린다. */
export type ChangeSet = Set<string>

/**
 * 한 트랜잭션 안에서 저장소를 만들어 작업을 실행한다. (설계 5.2)
 * - 작업 중 예외가 나면 그 안의 쓰기가 모두 취소되고, 알림도 보내지 않는다.
 * - 커밋된 뒤 changes에 모인 블록이 있으면 notifier로 알린다. 비어 있으면 알리지 않는다.
 * - 알림이 실패해도 이미 커밋된 변경이므로 서비스는 성공으로 끝난다. (설계 9.4)
 * better-sqlite3 트랜잭션은 동기이므로 fn 안에서 await를 쓰지 않는다.
 */
export function inTransaction<T>(
  deps: ServiceDeps,
  fn: (repos: Repositories, changes: ChangeSet) => T
): T {
  const changes: ChangeSet = new Set()
  const result = deps.db.transaction((tx) => fn(createRepositories(tx, deps.newId), changes))

  if (changes.size > 0) {
    notifySafely('blocksChanged', () => deps.notifier.blocksChanged([...changes]))
  }
  return result
}

/** 커밋 뒤의 알림. 실패해도 로그만 남기고 서비스는 성공으로 끝난다. (설계 9.4) */
export function notifySafely(name: string, send: () => void): void {
  try {
    send()
  } catch (error) {
    console.error(`[notifier] ${name} failed`, error)
  }
}
