import type { BlockListFilter } from '@shared/views'

/** 스튜디오 화면: 블록 목록 탭 4개 + 캘린더 (설계 9.6, 7.5) */
export type StudioView = BlockListFilter | 'calendar'

/** 왼쪽 탭 중 블록 목록 (설계 9.6) */
export const TABS: readonly { filter: BlockListFilter; label: string; empty: string }[] = [
  { filter: 'needsInput', label: '채워 주세요', empty: '채울 블록이 없어요.' },
  { filter: 'undated', label: '날짜 없는 일', empty: '날짜 없이 둔 일이 없어요.' },
  { filter: 'all', label: '전체', empty: '아직 블록이 없어요.' },
  { filter: 'completed', label: '완료', empty: '완료한 블록이 없어요.' },
  {
    filter: 'trash',
    label: '휴지통',
    empty: '휴지통이 비어 있어요. 삭제한 블록은 30일 뒤 사라져요.'
  }
]
