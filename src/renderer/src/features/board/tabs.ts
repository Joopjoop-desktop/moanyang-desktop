import type { BlockListFilter } from '@shared/views'

/** 왼쪽 탭 (설계 9.6). 캘린더는 8단계에서 추가한다. */
export const TABS: readonly { filter: BlockListFilter; label: string; empty: string }[] = [
  { filter: 'inbox', label: '검토함', empty: '검토할 블록이 없어요. 먹이를 주면 여기에 나타나요.' },
  { filter: 'all', label: '전체', empty: '아직 블록이 없어요.' },
  { filter: 'completed', label: '완료', empty: '완료한 블록이 없어요.' },
  {
    filter: 'trash',
    label: '휴지통',
    empty: '휴지통이 비어 있어요. 삭제한 블록은 30일 뒤 사라져요.'
  }
]
