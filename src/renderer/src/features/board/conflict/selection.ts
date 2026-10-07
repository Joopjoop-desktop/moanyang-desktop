import type { ElementType } from '@shared/model'
import type { ConflictPreview, ConflictResolution, ConflictSelection } from '@shared/moves'
import type { ElementView } from '@shared/views'

/**
 * 충돌 선택 창의 상태 계산. (설계 7.2, 9.6)
 * 선택 = 묶음(요소 종류)별 "남길 요소 ID 목록"
 */

/** 처음에는 대상 블록에 원래 있던 요소에 체크한다 */
export function defaultSelection(preview: ConflictPreview): ConflictSelection {
  const selection: ConflictSelection = {}
  for (const group of preview.groups) {
    selection[group.type] = group.existing.map((element) => element.id)
  }
  return selection
}

export function isSelected(selection: ConflictSelection, type: ElementType, id: string): boolean {
  return selection[type]?.includes(id) ?? false
}

/** 체크를 켜고 끈다 (새 선택을 돌려준다) */
export function toggle(
  selection: ConflictSelection,
  type: ElementType,
  id: string
): ConflictSelection {
  const current = selection[type] ?? []
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  return { ...selection, [type]: next }
}

/** 묶음마다 하나 이상 골라야 확인할 수 있다 */
export function canConfirm(preview: ConflictPreview, selection: ConflictSelection): boolean {
  return preview.groups.every((group) =>
    membersOf(group).some((element) => isSelected(selection, group.type, element.id))
  )
}

/** 코어에 보낼 선택 결과. 묶음에 있는 요소만 담고, 미리보기 당시 블록 시각을 함께 보낸다 (설계 7.1) */
export function toResolution(
  preview: ConflictPreview,
  selection: ConflictSelection
): ConflictResolution {
  const picked: ConflictSelection = {}
  for (const group of preview.groups) {
    picked[group.type] = membersOf(group)
      .filter((element) => isSelected(selection, group.type, element.id))
      .map((element) => element.id)
  }
  return {
    selection: picked,
    previewed: {
      sourceUpdatedAt: preview.sourceUpdatedAt,
      targetUpdatedAt: preview.targetUpdatedAt
    }
  }
}

/**
 * 미리보기를 다시 받았을 때 이전 선택을 옮긴다. (설계 9.6)
 * ID와 값(value, dateValue, timeValue)이 모두 그대로인 요소만 이전 체크 상태를 유지하고,
 * 값이 바뀌었거나 새로 생긴 요소는 기본값(원래 있던 요소면 체크)으로 돌아간다.
 */
export function carryOverSelection(
  previous: ConflictPreview,
  previousSelection: ConflictSelection,
  next: ConflictPreview
): ConflictSelection {
  const before = new Map<string, { element: ElementView; selected: boolean }>()
  for (const group of previous.groups) {
    for (const element of membersOf(group)) {
      before.set(element.id, {
        element,
        selected: isSelected(previousSelection, group.type, element.id)
      })
    }
  }

  const selection: ConflictSelection = {}
  for (const group of next.groups) {
    const existingIds = new Set(group.existing.map((element) => element.id))
    selection[group.type] = membersOf(group)
      .filter((element) => {
        const old = before.get(element.id)
        return old && sameValue(old.element, element) ? old.selected : existingIds.has(element.id)
      })
      .map((element) => element.id)
  }
  return selection
}

function membersOf(group: ConflictPreview['groups'][number]): ElementView[] {
  return [...group.existing, ...group.incoming]
}

/** rawText는 비교하지 않는다 (설계 7.2 같은 값 기준과 동일) */
function sameValue(a: ElementView, b: ElementView): boolean {
  return a.value === b.value && a.dateValue === b.dateValue && a.timeValue === b.timeValue
}
