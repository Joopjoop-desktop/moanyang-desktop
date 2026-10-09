import type { CreateElementInput, UpdateElementInput } from '@shared/elements'
import type { ElementView } from '@shared/views'
import { planDeleteElement } from '../domain/deletion'
import { planAddElement } from '../domain/elementAdd'
import { normalizeElementUpdate } from '../domain/elementValues'
import { DomainError } from '../domain/errors'
import type { Repositories } from '../repositories'
import { toDomainElement, type ElementRow } from '../repositories/elementRepository'
import { inTransaction, type ServiceDeps } from './deps'
import { toElementView } from './views'

/**
 * 요소 추가·수정·확인·삭제. 이동은 MoveService가 맡는다.
 * 요소가 바뀌면 속한 블록의 updatedAt도 갱신한다. (설계 6.4)
 */
export class ElementService {
  constructor(private readonly deps: ServiceDeps) {}

  /**
   * 사용자가 요소를 추가한다. (설계 1.4, 7.7)
   * 할 일·시작일·마감일·요청자는 블록에 없을 때만(있으면 ELEMENT_KIND_EXISTS), 상세·메모는 언제든.
   * 정해진 순서 자리에 넣고 블록 요소의 orderIndex를 다시 매긴다(다른 요소 재번호는 History 없음, 6.2).
   * 날짜는 사람이 정한 값이라 원래 표현 없이 확인된 상태로 만든다.
   */
  create(input: CreateElementInput): ElementView {
    const { blockId, type } = input
    return inTransaction(this.deps, (repos, changes) => {
      const block = repos.blocks.findLiveById(blockId)
      if (!block) throw new DomainError('BLOCK_NOT_FOUND', `블록이 없습니다: ${blockId}`)
      const values = normalizeElementUpdate(type, input)

      const id = this.deps.newId()
      const elements = repos.elements.findLiveByBlock(blockId)
      const order = planAddElement({ blockId, elements: elements.map(toDomainElement) }, type, id)

      const at = this.deps.now()
      repos.elements.insert({
        id,
        blockId,
        type,
        ...values,
        captureId: null,
        orderIndex: order.elementIds.indexOf(id),
        createdAt: at,
        updatedAt: at
      })
      repos.elements.applyOrder(order.elementIds)
      const created = loadLiveElement(repos, id)
      repos.history.record(
        {
          entityType: 'element',
          entityId: id,
          action: 'element.created',
          before: null,
          after: { ...created }
        },
        at
      )
      repos.blocks.touch(blockId, at)
      changes.add(blockId)
      return toElementView(created)
    })
  }

  /**
   * 값을 수정한다. 날짜 요소는 원래 표현을 비우고 확인 필요를 끈다. (설계 6.2)
   * 바뀐 값이 없으면 아무것도 바꾸지 않는다.
   */
  update(elementId: string, input: UpdateElementInput): ElementView {
    return inTransaction(this.deps, (repos, changes) => {
      const row = loadLiveElement(repos, elementId)
      const patch = normalizeElementUpdate(row.type, input)

      const before: Record<string, unknown> = {}
      const after: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(patch)) {
        const current = row[key as keyof ElementRow]
        if (current !== value) {
          before[key] = current
          after[key] = value
        }
      }
      if (Object.keys(after).length === 0) return toElementView(row)

      const at = this.deps.now()
      repos.elements.update(elementId, { ...patch, updatedAt: at })
      repos.history.record(
        { entityType: 'element', entityId: elementId, action: 'element.updated', before, after },
        at
      )
      repos.blocks.touch(row.blockId, at)
      changes.add(row.blockId)
      return toElementView(loadLiveElement(repos, elementId))
    })
  }

  /** 값을 바꾸지 않고 "확인 필요"만 끈다. (설계 6.2) */
  confirm(elementId: string): ElementView {
    return inTransaction(this.deps, (repos, changes) => {
      const row = loadLiveElement(repos, elementId)
      if (!row.needsConfirm) return toElementView(row)

      const at = this.deps.now()
      repos.elements.update(elementId, { needsConfirm: false, updatedAt: at })
      repos.history.record(
        {
          entityType: 'element',
          entityId: elementId,
          action: 'element.updated',
          before: { needsConfirm: true },
          after: { needsConfirm: false }
        },
        at
      )
      repos.blocks.touch(row.blockId, at)
      changes.add(row.blockId)
      return toElementView(loadLiveElement(repos, elementId))
    })
  }

  /**
   * 요소를 삭제한다. 마지막 요소면 요소 대신 블록을 user로 삭제한다. (설계 7.3)
   */
  delete(elementId: string): void {
    inTransaction(this.deps, (repos, changes) => {
      const row = loadLiveElement(repos, elementId)
      const blockRow = repos.blocks.findLiveById(row.blockId)
      const elements = repos.elements.findLiveByBlock(row.blockId)
      const plan = planDeleteElement(
        { blockId: row.blockId, elements: elements.map(toDomainElement) },
        elementId
      )
      const at = this.deps.now()

      if (plan.kind === 'block') {
        // 요소는 그대로 두고 블록만 삭제. History는 block.deleted 하나만 남긴다.
        repos.blocks.softDelete(plan.blockId, plan.deleteReason, at)
        changes.add(plan.blockId)
        repos.history.record(
          {
            entityType: 'block',
            entityId: plan.blockId,
            action: 'block.deleted',
            before: { ...blockRow },
            after: {
              deletedAt: at,
              deleteReason: plan.deleteReason,
              trigger: plan.trigger.action,
              elementId: plan.trigger.elementId
            }
          },
          at
        )
        return
      }

      repos.elements.softDelete(elementId, plan.deleteReason, at)
      repos.elements.applyOrder(plan.order.elementIds)
      repos.history.record(
        {
          entityType: 'element',
          entityId: elementId,
          action: 'element.deleted',
          before: { ...row },
          after: { deletedAt: at, deleteReason: plan.deleteReason }
        },
        at
      )
      repos.blocks.touch(row.blockId, at)
      changes.add(row.blockId)
    })
  }
}

function loadLiveElement(repos: Repositories, elementId: string): ElementRow {
  const row = repos.elements.findLiveById(elementId)
  if (!row) throw new DomainError('ELEMENT_NOT_FOUND', `요소가 없습니다: ${elementId}`)
  return row
}
