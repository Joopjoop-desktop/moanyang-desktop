import { eq } from 'drizzle-orm'
import type { SystemLabelKey } from '@shared/model'
import { newId } from '../infra/id'
import type { AppDatabase } from './connection'
import { labels } from './schema'

type SystemLabelDefinition = {
  key: SystemLabelKey
  name: string
  groupKey: string | null
}

/** 시스템 라벨 목록. 코드는 이름이 아닌 key로 라벨을 찾는다. (설계 6.2 Label) */
const SYSTEM_LABELS: readonly SystemLabelDefinition[] = [
  { key: 'coordinating', name: '조율 중', groupKey: 'progress' },
  { key: 'waiting_reply', name: '회신 대기', groupKey: 'progress' }
]

/**
 * key 기준으로 없는 시스템 라벨은 추가하고, 이름·그룹이 바뀌었으면 갱신한다.
 * 앱 시작 시 마이그레이션 직후 실행한다. 사용자 변경이 아니므로 History는 남기지 않는다.
 */
export function ensureSystemLabels(db: AppDatabase): void {
  db.transaction((tx) => {
    for (const def of SYSTEM_LABELS) {
      const existing = tx.select().from(labels).where(eq(labels.key, def.key)).get()

      if (!existing) {
        tx.insert(labels)
          .values({
            id: newId(),
            key: def.key,
            name: def.name,
            isSystem: true,
            groupKey: def.groupKey
          })
          .run()
        continue
      }

      if (existing.name !== def.name || existing.groupKey !== def.groupKey || !existing.isSystem) {
        tx.update(labels)
          .set({ name: def.name, groupKey: def.groupKey, isSystem: true })
          .where(eq(labels.id, existing.id))
          .run()
      }
    }
  })
}
