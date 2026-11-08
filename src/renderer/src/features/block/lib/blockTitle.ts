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

/** 칩 색: 날짜 쪽은 빨강, 할 일 쪽은 파랑 (Figma Chips) */
export type MissingTone = 'date' | 'task'

const MISSING_CHIPS: Record<MissingEssential, { label: string; tone: MissingTone }> = {
  task: { label: '할 일 없음', tone: 'task' },
  date: { label: '날짜 없음', tone: 'date' },
  dateConfirm: { label: '날짜 확인', tone: 'date' }
}

/** 빠진 것마다 칩 하나. 코어가 알려 준 순서(task → date → dateConfirm) 그대로. 빠진 게 없으면 빈 목록 */
export function missingChips(block: BlockView): { label: string; tone: MissingTone }[] {
  return block.missing.map((missing) => MISSING_CHIPS[missing])
}
