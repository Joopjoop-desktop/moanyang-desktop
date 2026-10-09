import type { ElementType } from '@shared/model'
import { inTransaction, type ServiceDeps } from '../services/deps'

/**
 * 개발 모드 전용: 콘솔 확인용 샘플 블록을 만든다. (설계 9.3 dev:seed)
 * 배포 빌드에서는 등록되지 않는다. 개발용 데이터라 History는 남기지 않는다.
 *
 * 블록 1과 3은 마감일·요청자가 겹쳐 합치기에서 충돌 선택을 해볼 수 있다.
 * 블록 5는 앞뒤 달에 걸친 기간이라 달력(설계 7.5)에서 달을 넘어가는 막대를 볼 수 있다.
 * @returns 만든 블록 ID (만든 순)
 */
export function seedSampleBlocks(deps: ServiceDeps): string[] {
  const today = deps.now().slice(0, 10)

  type SampleElement = {
    type: ElementType
    value?: string
    dateValue?: string
    rawText?: string
    needsConfirm?: boolean
  }
  const samples: SampleElement[][] = [
    [
      { type: 'task', value: '견적서 송부' },
      { type: 'requester', value: '김과장 (한빛정밀)' },
      {
        type: 'due_date',
        dateValue: addDays(today, 3),
        rawText: '이번주 금요일까지',
        needsConfirm: true
      }
    ],
    [
      { type: 'task', value: '납기 일정 확인' },
      { type: 'detail', value: 'A-102 브래킷 500개' },
      { type: 'start_date', dateValue: addDays(today, 1) },
      { type: 'due_date', dateValue: addDays(today, 8) }
    ],
    [
      { type: 'task', value: '견적서 단가 수정' },
      { type: 'requester', value: '김 과장' },
      { type: 'due_date', dateValue: addDays(today, 4) }
    ],
    [{ type: 'memo', value: '다음 주 화요일 생산팀 회의 전에 재고 확인' }],
    [
      { type: 'task', value: '분기 보고서 준비' },
      { type: 'start_date', dateValue: addDays(today, -20) },
      { type: 'due_date', dateValue: addDays(today, 25) }
    ]
  ]

  return inTransaction(deps, (repos, changes) => {
    const at = deps.now()
    return samples.map((elements) => {
      const blockId = deps.newId()
      repos.blocks.insert(blockId, at)
      elements.forEach((element, orderIndex) => {
        repos.elements.insert({
          id: deps.newId(),
          blockId,
          type: element.type,
          value: element.value ?? null,
          dateValue: element.dateValue ?? null,
          rawText: element.rawText ?? null,
          needsConfirm: element.needsConfirm ?? false,
          orderIndex,
          createdAt: at,
          updatedAt: at
        })
      })
      changes.add(blockId)
      return blockId
    })
  })
}

/** YYYY-MM-DD에 날짜를 더한다. */
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
