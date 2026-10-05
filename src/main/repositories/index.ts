import { BlockRepository } from './blockRepository'
import { ElementRepository } from './elementRepository'
import type { DbExecutor } from './executor'
import { HistoryRepository } from './historyRepository'
import { LabelRepository } from './labelRepository'

export type Repositories = {
  blocks: BlockRepository
  elements: ElementRepository
  labels: LabelRepository
  history: HistoryRepository
}

/**
 * 같은 실행 대상(DB 또는 트랜잭션)을 공유하는 저장소 묶음을 만든다.
 * 서비스는 트랜잭션마다 이 함수로 저장소를 만들어, 모든 쓰기가 같은 트랜잭션에 들어가게 한다.
 */
export function createRepositories(db: DbExecutor, newId: () => string): Repositories {
  return {
    blocks: new BlockRepository(db),
    elements: new ElementRepository(db),
    labels: new LabelRepository(db),
    history: new HistoryRepository(db, newId)
  }
}
