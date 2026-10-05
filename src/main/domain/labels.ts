import type { DomainLabel } from './types'

/**
 * 블록에 라벨을 붙일 때 바뀌어야 할 내용. (설계 7.4)
 * - attach: 새로 붙이는지 → History `label.attached` (attachedAt = 지금)
 * - detachLabelIds: 같은 그룹이라 떼어지는 기존 라벨 → History `label.detached`
 */
export type AttachLabelPlan = {
  attach: boolean
  detachLabelIds: string[]
}

/**
 * @param attached 블록에 지금 붙어 있는 라벨
 * @param label 붙이려는 라벨
 */
export function planAttachLabel(
  attached: readonly DomainLabel[],
  label: DomainLabel
): AttachLabelPlan {
  // 이미 붙어 있으면 아무것도 바꾸지 않는다 (attachedAt 유지 → "N일째"가 초기화되지 않음)
  if (attached.some((current) => current.id === label.id)) {
    return { attach: false, detachLabelIds: [] }
  }

  // groupKey가 없는 라벨은 다른 라벨에 영향을 주지 않는다
  const detachLabelIds =
    label.groupKey === null
      ? []
      : attached.filter((current) => current.groupKey === label.groupKey).map((l) => l.id)

  return { attach: true, detachLabelIds }
}
