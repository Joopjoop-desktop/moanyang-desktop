import { inTransaction, type ServiceDeps } from './deps'

/** 소프트 딜리트 후 보관 기간 (설계 6.4) */
export const RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export type PurgeResult = {
  blocks: number
  elements: number
  captures: number
}

/**
 * 하드 딜리트. 앱 시작 시 보관 기간이 지난 데이터를 한 트랜잭션으로 지운다. (설계 6.4 하드 딜리트)
 * 1. 삭제된 지 오래된 블록 (user, emptied) → 그 요소·라벨 연결(CASCADE), 블록·요소 History
 * 2. 블록 상태와 상관없이 요소 자신이 삭제된 지 오래된 요소 → 그 요소 History
 * 3. 처리가 끝났고 연결된 요소가 없는 오래된 Capture
 * 1·2를 먼저 해야 요소가 사라진 Capture가 3에서 함께 정리된다.
 */
export class PurgeService {
  constructor(private readonly deps: ServiceDeps) {}

  purgeExpired(retentionDays: number = RETENTION_DAYS): PurgeResult {
    return inTransaction(this.deps, (repos) => {
      const cutoff = new Date(Date.parse(this.deps.now()) - retentionDays * DAY_MS).toISOString()

      const blockIds = repos.blocks.findExpiredIds(cutoff)
      const blockElementIds = repos.elements.findIdsByBlocksIncludingDeleted(blockIds)
      repos.history.deleteForEntities('element', blockElementIds)
      repos.history.deleteForEntities('block', blockIds)
      repos.blocks.deleteByIds(blockIds)

      const elementIds = repos.elements.findExpiredIds(cutoff)
      repos.history.deleteForEntities('element', elementIds)
      repos.elements.deleteByIds(elementIds)

      const captures = repos.captures.deleteExpiredOrphans(cutoff)

      return {
        blocks: blockIds.length,
        elements: blockElementIds.length + elementIds.length,
        captures
      }
    })
  }
}
