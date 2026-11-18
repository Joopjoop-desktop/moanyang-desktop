import type { BlockView } from '@shared/views'
import clsx from 'clsx'
import { formatTimestamp } from '@renderer/lib/display'
import { blockTitle, missingChips, type MissingTone } from '@renderer/features/block/lib/blockTitle'

/** 빠진 것 칩 (Figma Chips): 날짜는 빨강, 할 일은 파랑 */
const chipTone: Record<MissingTone, string> = {
  date: 'bg-warn-soft text-warn',
  task: 'bg-accent-soft text-accent'
}

type Props = {
  block: BlockView
  /** 펼친 카드는 시각 글자를 더 진하게 (Figma Main_Arcodian Menu Open) */
  open?: boolean
  /** false면 빠진 것 칩을 숨긴다 (날짜 없는 일 목록은 모두 "날짜 없음"이라 따로 표시하지 않는다) */
  showMissing?: boolean
}

/**
 * 카드 머리의 글자 부분: 제목 + 빠진 것 칩("날짜 없음", "할 일 없음") 한 줄, 아래에 시각 한 줄.
 * 목록의 한 줄 항목과 캘린더 옆 블록 카드가 같이 쓴다.
 */
export function BlockTitleLine({
  block,
  open = false,
  showMissing = true
}: Props): React.JSX.Element {
  const chips = showMissing ? missingChips(block) : []

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 items-center gap-2">
        <span className="max-w-[13.9375rem] min-w-0 truncate text-lg/6 font-semibold text-gray-90">
          {blockTitle(block)}
        </span>
        {chips.map((chip) => (
          <span
            key={chip.label}
            className={clsx(
              'shrink-0 rounded-pill px-2 text-xs/6 font-medium whitespace-nowrap',
              chipTone[chip.tone]
            )}
          >
            {chip.label}
          </span>
        ))}
      </div>
      <span className={clsx('text-xs/6', open ? 'text-gray-70' : 'text-gray-50')}>
        {blockMetaText(block)}
      </span>
    </div>
  )
}

/** 삭제·완료된 블록은 그 시각과 상태, 아니면 만든 시각 */
function blockMetaText(block: BlockView): string {
  if (block.deletedAt) return `${formatTimestamp(block.deletedAt)} 삭제`
  if (block.completedAt) return `${formatTimestamp(block.completedAt)} 완료`
  return formatTimestamp(block.createdAt)
}
