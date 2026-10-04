import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  BlockDeleteReason,
  CaptureMethod,
  CaptureStatus,
  ElementDeleteReason,
  ElementType
} from '@shared/model'

/*
 * 테이블 정의 (설계 6.2, 6.4)
 * - ID: UUID v7 문자열
 * - 시각: ISO 문자열 (nowIso()로만 생성)
 * - 컬럼 이름: DB는 snake_case, 코드는 camelCase
 */

/** 먹이를 준 행위. 원문 텍스트는 저장하지 않는다. */
export const captures = sqliteTable('captures', {
  id: text('id').primaryKey(),
  method: text('method').$type<CaptureMethod>().notNull(),
  sourceApp: text('source_app'),
  status: text('status').$type<CaptureStatus>().notNull(),
  errorCode: text('error_code'),
  capturedAt: text('captured_at').notNull()
})

/** 요소를 담는 그릇. */
export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey(),
  reviewedAt: text('reviewed_at'),
  completedAt: text('completed_at'),
  deletedAt: text('deleted_at'),
  deleteReason: text('delete_reason').$type<BlockDeleteReason>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

/** 블록 안의 정보 한 조각. */
export const elements = sqliteTable(
  'elements',
  {
    id: text('id').primaryKey(),
    blockId: text('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    type: text('type').$type<ElementType>().notNull(),
    /** 텍스트 요소(task, detail, requester, memo)의 값 */
    value: text('value'),
    /** 날짜 요소의 날짜 YYYY-MM-DD (UTC로 바꾸지 않음) */
    dateValue: text('date_value'),
    /** 날짜 요소의 시간 HH:mm, 언급됐을 때만 */
    timeValue: text('time_value'),
    /** 날짜 원래 표현 ("다음주 금요일까지") */
    rawText: text('raw_text'),
    needsConfirm: integer('needs_confirm', { mode: 'boolean' }).notNull().default(false),
    captureId: text('capture_id').references(() => captures.id, { onDelete: 'set null' }),
    orderIndex: integer('order_index').notNull(),
    deletedAt: text('deleted_at'),
    deleteReason: text('delete_reason').$type<ElementDeleteReason>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('elements_block_id_idx').on(table.blockId),
    index('elements_date_value_idx').on(table.dateValue),
    // Capture 하드 딜리트(연결된 요소 확인)와 SET NULL 처리용
    index('elements_capture_id_idx').on(table.captureId)
  ]
)

/** 상태 라벨. 시스템 라벨은 key로 찾는다. */
export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  /** 시스템 라벨 식별자, 사용자 라벨은 null */
  key: text('key').unique(),
  name: text('name').notNull(),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  /** 같은 그룹 안에서는 하나만 붙음 */
  groupKey: text('group_key')
})

/** 블록–라벨 N:M */
export const blockLabels = sqliteTable(
  'block_labels',
  {
    blockId: text('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    /** "회신 대기 N일째" 계산용 */
    attachedAt: text('attached_at').notNull()
  },
  (table) => [primaryKey({ columns: [table.blockId, table.labelId] })]
)

/** 변경 이력. 추가 전용, 수정·삭제하지 않는다(하드 딜리트 제외). */
export const history = sqliteTable(
  'history',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    before: text('before', { mode: 'json' }),
    after: text('after', { mode: 'json' }),
    occurredAt: text('occurred_at').notNull()
  },
  (table) => [index('history_entity_idx').on(table.entityType, table.entityId)]
)
