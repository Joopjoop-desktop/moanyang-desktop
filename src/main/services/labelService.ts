import type { AttachedLabelView, LabelView } from '@shared/views'
import { DomainError } from '../domain/errors'
import { planAttachLabel } from '../domain/labels'
import type { Repositories } from '../repositories'
import { inTransaction, type ServiceDeps } from './deps'
import { toAttachedLabelView, toLabelView } from './views'

/**
 * 라벨 목록과 블록 라벨 붙이기·떼기. (설계 7.4)
 * 라벨 변경 History는 블록을 대상으로 기록한다. (설계 6.2)
 */
export class LabelService {
  constructor(private readonly deps: ServiceDeps) {}

  list(): LabelView[] {
    return inTransaction(this.deps, (repos) => repos.labels.findAll().map(toLabelView))
  }

  /**
   * 라벨을 붙인다. 같은 그룹 라벨이 있으면 떼고 붙인다.
   * 이미 붙어 있으면 아무것도 바꾸지 않는다 (attachedAt 유지).
   * @returns 블록에 붙은 라벨
   */
  attach(blockId: string, labelId: string): AttachedLabelView[] {
    return inTransaction(this.deps, (repos) => {
      assertLiveBlock(repos, blockId)
      const label = repos.labels.findById(labelId)
      if (!label) throw new DomainError('LABEL_NOT_FOUND', `라벨이 없습니다: ${labelId}`)

      const attached = repos.labels.findAttachedToBlock(blockId)
      const plan = planAttachLabel(attached, label)
      if (!plan.attach) return attached.map(toAttachedLabelView)

      const at = this.deps.now()
      for (const detachId of plan.detachLabelIds) {
        const current = attached.find((l) => l.id === detachId)
        repos.labels.detach(blockId, detachId)
        repos.history.record(
          {
            entityType: 'block',
            entityId: blockId,
            action: 'label.detached',
            before: { labelId: detachId, attachedAt: current?.attachedAt ?? null },
            after: null
          },
          at
        )
      }

      repos.labels.attach(blockId, labelId, at)
      repos.history.record(
        {
          entityType: 'block',
          entityId: blockId,
          action: 'label.attached',
          before: null,
          after: { labelId, attachedAt: at }
        },
        at
      )
      repos.blocks.touch(blockId, at)
      return repos.labels.findAttachedToBlock(blockId).map(toAttachedLabelView)
    })
  }

  /**
   * 라벨을 뗀다. 붙어 있지 않으면 아무것도 바꾸지 않는다.
   * @returns 블록에 붙은 라벨
   */
  detach(blockId: string, labelId: string): AttachedLabelView[] {
    return inTransaction(this.deps, (repos) => {
      assertLiveBlock(repos, blockId)
      const attached = repos.labels.findAttachedToBlock(blockId)
      const current = attached.find((l) => l.id === labelId)
      if (!current) return attached.map(toAttachedLabelView)

      const at = this.deps.now()
      repos.labels.detach(blockId, labelId)
      repos.history.record(
        {
          entityType: 'block',
          entityId: blockId,
          action: 'label.detached',
          before: { labelId, attachedAt: current.attachedAt },
          after: null
        },
        at
      )
      repos.blocks.touch(blockId, at)
      return repos.labels.findAttachedToBlock(blockId).map(toAttachedLabelView)
    })
  }
}

function assertLiveBlock(repos: Repositories, blockId: string): void {
  if (!repos.blocks.findLiveById(blockId)) {
    throw new DomainError('BLOCK_NOT_FOUND', `블록이 없습니다: ${blockId}`)
  }
}
