import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ElementType } from '@shared/model'
import type { DatabaseConnection } from '../db/connection'
import { createTestDatabase } from '../db/testDatabase'
import { DomainError } from '../domain/errors'
import { newId } from '../infra/id'
import { createRepositories, type Repositories } from '../repositories'
import type { ServiceDeps } from './deps'
import { MoveService } from './moveService'

const SEED_AT = '2026-10-01T00:00:00.000Z'

describe('MoveService', () => {
  let connection: DatabaseConnection
  let repos: Repositories
  let service: MoveService
  let tick: number

  beforeEach(() => {
    connection = createTestDatabase()
    repos = createRepositories(connection.db, newId)
    tick = 0
    // 호출할 때마다 1초씩 늘어나는 고정 시계
    const now = (): string => new Date(Date.UTC(2026, 9, 6, 0, 0, tick++)).toISOString()
    const deps: ServiceDeps = {
      db: connection.db,
      now,
      newId,
      notifier: {
        blocksChanged: () => {},
        captureCompleted: () => {},
        captureFailed: () => {},
        captureUnfinishedChanged: () => {}
      }
    }
    service = new MoveService(deps)
  })

  afterEach(() => {
    connection.close()
  })

  function seedBlock(blockId: string): void {
    repos.blocks.insert(blockId, SEED_AT)
  }

  function seedElement(
    id: string,
    blockId: string,
    type: ElementType,
    orderIndex: number,
    values: { value?: string; dateValue?: string; needsConfirm?: boolean } = {}
  ): void {
    repos.elements.insert({
      id,
      blockId,
      type,
      orderIndex,
      value: values.value ?? null,
      dateValue: values.dateValue ?? null,
      needsConfirm: values.needsConfirm ?? false,
      createdAt: SEED_AT,
      updatedAt: SEED_AT
    })
  }

  function liveIds(blockId: string): string[] {
    return repos.elements.findLiveByBlock(blockId).map((e) => e.id)
  }

  function actions(entityType: 'block' | 'element', id: string): string[] {
    return repos.history.findByEntity(entityType, id).map((h) => h.action)
  }

  function expectDomainError(fn: () => unknown, code: string): void {
    try {
      fn()
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError)
      expect((error as DomainError).code).toBe(code)
      return
    }
    throw new Error(`DomainError(${code})가 발생하지 않았습니다`)
  }

  describe('요소 이동', () => {
    beforeEach(() => {
      seedBlock('src')
      seedBlock('dst')
      seedElement('s-task', 'src', 'task', 0, { value: '견적서' })
      seedElement('s-memo', 'src', 'memo', 1, { value: '메모' })
      seedElement('d-task', 'dst', 'task', 0, { value: '발주' })
    })

    it('다른 블록의 지정 위치로 옮기고 element.moved를 남긴다', () => {
      const result = service.moveElementToBlock({
        elementId: 's-memo',
        targetBlockId: 'dst',
        insertIndex: 0
      })

      expect(liveIds('dst')).toEqual(['s-memo', 'd-task'])
      expect(liveIds('src')).toEqual(['s-task'])
      expect(result.changedBlockIds.sort()).toEqual(['dst', 'src'])
      expect(repos.history.findByEntity('element', 's-memo')).toMatchObject([
        {
          action: 'element.moved',
          before: { blockId: 'src', orderIndex: 1 },
          after: { blockId: 'dst', orderIndex: 0 }
        }
      ])
    })

    it('원본·대상 블록의 updatedAt을 갱신한다', () => {
      service.moveElementToBlock({ elementId: 's-memo', targetBlockId: 'dst' })

      expect(repos.blocks.findLiveById('src')?.updatedAt).not.toBe(SEED_AT)
      expect(repos.blocks.findLiveById('dst')?.updatedAt).not.toBe(SEED_AT)
    })

    it('다른 요소의 순서 재번호는 History에 남기지 않는다', () => {
      service.moveElementToBlock({ elementId: 's-memo', targetBlockId: 'dst', insertIndex: 0 })

      expect(actions('element', 'd-task')).toEqual([])
      expect(actions('element', 's-task')).toEqual([])
    })

    it('없는 요소면 ELEMENT_NOT_FOUND', () => {
      expectDomainError(
        () => service.moveElementToBlock({ elementId: 'nope', targetBlockId: 'dst' }),
        'ELEMENT_NOT_FOUND'
      )
    })

    it('없는 대상 블록이면 BLOCK_NOT_FOUND', () => {
      expectDomainError(
        () => service.moveElementToBlock({ elementId: 's-memo', targetBlockId: 'nope' }),
        'BLOCK_NOT_FOUND'
      )
    })
  })

  describe('같은 블록 안 순서 변경', () => {
    beforeEach(() => {
      seedBlock('b')
      seedElement('a', 'b', 'memo', 0)
      seedElement('c', 'b', 'memo', 1)
      seedElement('d', 'b', 'memo', 2)
    })

    it('옮긴 요소만 element.moved로 기록한다', () => {
      service.reorderElement('d', 0)

      expect(liveIds('b')).toEqual(['d', 'a', 'c'])
      expect(repos.history.findByEntity('element', 'd')).toMatchObject([
        { action: 'element.moved', before: { orderIndex: 2 }, after: { orderIndex: 0 } }
      ])
      expect(actions('element', 'a')).toEqual([])
    })

    it('위치가 그대로면 아무것도 바꾸지 않는다', () => {
      const result = service.reorderElement('c', 1)

      expect(result.changedBlockIds).toEqual([])
      expect(repos.blocks.findLiveById('b')?.updatedAt).toBe(SEED_AT)
    })
  })

  describe('블록 합치기', () => {
    it('값이 모두 같으면 자동 정리하고 원본 블록을 emptied로 삭제하며 라벨을 뗀다', () => {
      seedBlock('src')
      seedBlock('dst')
      seedElement('s-due', 'src', 'due_date', 0, { dateValue: '2026-10-09' })
      seedElement('d-due', 'dst', 'due_date', 0, {
        dateValue: '2026-10-09',
        needsConfirm: true
      })
      const label = repos.labels.findAll()[0]
      repos.labels.attach('src', label.id, SEED_AT)

      service.mergeBlocks({ sourceBlockId: 'src', targetBlockId: 'dst' })

      // 대상 블록: 기존 요소만 남고, 확인된 쪽이 버려졌으므로 확인 필요가 꺼진다
      expect(liveIds('dst')).toEqual(['d-due'])
      expect(repos.elements.findLiveById('d-due')?.needsConfirm).toBe(false)
      expect(actions('element', 'd-due')).toEqual(['element.updated'])

      // 옮겨온 요소는 discarded
      const discarded = repos.elements.findByIdIncludingDeleted('s-due')
      expect(discarded?.deleteReason).toBe('discarded')
      expect(repos.history.findByEntity('element', 's-due')).toMatchObject([
        { action: 'element.discarded', after: { cause: 'auto' } }
      ])

      // 원본 블록: emptied 삭제 + 라벨 연결 제거
      expect(repos.blocks.findByIdIncludingDeleted('src')?.deleteReason).toBe('emptied')
      expect(repos.labels.findAttachedToBlock('src')).toEqual([])
      expect(actions('block', 'src')).toEqual(['label.detached', 'block.deleted'])
    })

    describe('충돌 선택', () => {
      beforeEach(() => {
        seedBlock('src')
        seedBlock('dst')
        seedElement('s-due', 'src', 'due_date', 0, { dateValue: '2026-10-10' })
        seedElement('d-due', 'dst', 'due_date', 0, { dateValue: '2026-10-09' })
      })

      it('미리보기는 충돌 묶음과 블록 updatedAt을 돌려주고 아무것도 바꾸지 않는다', () => {
        const preview = service.previewMergeBlocks('src', 'dst')

        expect(preview).toMatchObject({
          requiresSelection: true,
          sourceUpdatedAt: SEED_AT,
          targetUpdatedAt: SEED_AT,
          groups: [{ type: 'due_date', existing: [{ id: 'd-due' }], incoming: [{ id: 's-due' }] }]
        })
        expect(liveIds('src')).toEqual(['s-due'])
        expect(actions('element', 's-due')).toEqual([])
      })

      it('선택 없이 합치면 CONFLICT_SELECTION_MISSING이고 아무것도 바뀌지 않는다', () => {
        expectDomainError(
          () => service.mergeBlocks({ sourceBlockId: 'src', targetBlockId: 'dst' }),
          'CONFLICT_SELECTION_MISSING'
        )

        expect(liveIds('src')).toEqual(['s-due'])
        expect(liveIds('dst')).toEqual(['d-due'])
      })

      it('미리보기 결과로 선택하면 고르지 않은 요소를 버린다', () => {
        const preview = service.previewMergeBlocks('src', 'dst')

        service.mergeBlocks({
          sourceBlockId: 'src',
          targetBlockId: 'dst',
          resolution: { selection: { due_date: ['s-due'] }, previewed: preview }
        })

        expect(liveIds('dst')).toEqual(['s-due'])
        expect(repos.history.findByEntity('element', 'd-due')).toMatchObject([
          { action: 'element.discarded', after: { cause: 'selection' } }
        ])
      })

      it('미리보기 이후 블록이 바뀌면 CONFLICT_PREVIEW_STALE이고 아무것도 바뀌지 않는다', () => {
        const preview = service.previewMergeBlocks('src', 'dst')
        // 미리보기 이후 대상 블록의 요소 값이 바뀜 → 블록 updatedAt 갱신
        repos.elements.update('d-due', { dateValue: '2026-10-12' })
        repos.blocks.touch('dst', '2026-10-05T00:00:00.000Z')

        expectDomainError(
          () =>
            service.mergeBlocks({
              sourceBlockId: 'src',
              targetBlockId: 'dst',
              resolution: { selection: { due_date: ['d-due'] }, previewed: preview }
            }),
          'CONFLICT_PREVIEW_STALE'
        )
        expect(liveIds('src')).toEqual(['s-due'])
      })
    })
  })

  describe('분리', () => {
    it('요소를 새 블록으로 옮기고 block.created를 남긴다', () => {
      seedBlock('src')
      seedElement('a', 'src', 'task', 0)
      seedElement('b', 'src', 'memo', 1)

      const result = service.splitElement('b')

      const created = result.createdBlockId
      expect(created).not.toBeNull()
      expect(liveIds(created as string)).toEqual(['b'])
      expect(liveIds('src')).toEqual(['a'])
      expect(actions('block', created as string)).toEqual(['block.created'])
      expect(actions('element', 'b')).toEqual(['element.moved'])
    })
  })
})
