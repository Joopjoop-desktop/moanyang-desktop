import { expect } from 'vitest'
import type { ElementType } from '@shared/model'
import type { DatabaseConnection } from '../db/connection'
import { createTestDatabase } from '../db/testDatabase'
import { DomainError } from '../domain/errors'
import { newId } from '../infra/id'
import { createRepositories, type Repositories } from '../repositories'
import type { ServiceDeps } from './deps'

/* 테스트 전용: 서비스 테스트 공통 준비. 앱 코드에서 import하지 않는다. */

export const SEED_AT = '2026-10-01T00:00:00.000Z'

export type ServiceTestContext = {
  connection: DatabaseConnection
  repos: Repositories
  deps: ServiceDeps
}

/** 메모리 DB와, 호출할 때마다 1초씩 늘어나는 고정 시계를 만든다. */
export function setupServiceTest(): ServiceTestContext {
  const connection = createTestDatabase()
  let tick = 0
  const now = (): string => new Date(Date.UTC(2026, 9, 6, 0, 0, tick++)).toISOString()
  return {
    connection,
    repos: createRepositories(connection.db, newId),
    deps: { db: connection.db, now, newId }
  }
}

export function seedBlock(repos: Repositories, blockId: string): void {
  repos.blocks.insert(blockId, SEED_AT)
}

export function seedElement(
  repos: Repositories,
  id: string,
  blockId: string,
  type: ElementType,
  orderIndex: number,
  values: { value?: string; dateValue?: string; rawText?: string; needsConfirm?: boolean } = {}
): void {
  repos.elements.insert({
    id,
    blockId,
    type,
    orderIndex,
    value: values.value ?? null,
    dateValue: values.dateValue ?? null,
    rawText: values.rawText ?? null,
    needsConfirm: values.needsConfirm ?? false,
    createdAt: SEED_AT,
    updatedAt: SEED_AT
  })
}

export function historyActions(
  repos: Repositories,
  entityType: 'block' | 'element',
  id: string
): string[] {
  return repos.history.findByEntity(entityType, id).map((h) => h.action)
}

export function expectDomainError(fn: () => unknown, code: string): void {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(code)
    return
  }
  throw new Error(`DomainError(${code})가 발생하지 않았습니다`)
}
