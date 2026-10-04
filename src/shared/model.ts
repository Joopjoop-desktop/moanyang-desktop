/**
 * DB에 문자열로 저장되는 종류 값들의 허용 목록. (설계 6.2, 6.4)
 * DB CHECK 제약 대신 이 타입으로만 제한한다. 값을 추가할 때는 여기만 고친다.
 */

export const CAPTURE_METHODS = ['drag', 'paste'] as const
export type CaptureMethod = (typeof CAPTURE_METHODS)[number]

export const CAPTURE_STATUSES = ['pending', 'extracting', 'done', 'failed'] as const
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number]

export const ELEMENT_TYPES = [
  'task',
  'detail',
  'start_date',
  'due_date',
  'requester',
  'memo'
] as const
export type ElementType = (typeof ELEMENT_TYPES)[number]

export const BLOCK_DELETE_REASONS = ['user', 'emptied'] as const
export type BlockDeleteReason = (typeof BLOCK_DELETE_REASONS)[number]

export const ELEMENT_DELETE_REASONS = ['user', 'discarded'] as const
export type ElementDeleteReason = (typeof ELEMENT_DELETE_REASONS)[number]

/** 시스템 라벨 식별자 (Label.key) */
export const SYSTEM_LABEL_KEYS = ['coordinating', 'waiting_reply'] as const
export type SystemLabelKey = (typeof SYSTEM_LABEL_KEYS)[number]
