import type { BlockView, MissingEssential } from '@shared/views'

/** 오른쪽 목록 패널의 한 줄 항목 계산 (설계 9.6) */

const TITLE_TYPES = ['task', 'requester', 'detail'] as const

/** 항목 제목: 할 일 → 요청자 → 상세 순으로 처음 있는 값, 없으면 "(할 일 없음)". 캘린더 항목과 같다(7.5) */
export function blockTitle(block: BlockView): string {
  for (const type of TITLE_TYPES) {
    const found = block.elements.find((element) => element.type === type && element.value)
    if (found?.value) return found.value
  }
  return '(할 일 없음)'
}

const MISSING_LABELS: Record<MissingEssential, string> = {
  task: '할 일 없음',
  date: '날짜 없음',
  dateConfirm: '날짜 확인'
}

/** 빠진 것 하나(task → date → dateConfirm 순의 첫 번째). 빠진 게 없으면 null */
export function missingLabel(block: BlockView): string | null {
  const [first] = block.missing
  return first ? MISSING_LABELS[first] : null
}
