import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CalendarService } from './calendarService'
import {
  SEED_AT,
  seedBlock,
  seedElement,
  setupServiceTest,
  type ServiceTestContext
} from './testSupport'

const OCTOBER = { from: '2026-10-01', to: '2026-10-31' }

describe('CalendarService (설계 7.5)', () => {
  let ctx: ServiceTestContext
  let service: CalendarService

  beforeEach(() => {
    ctx = setupServiceTest()
    service = new CalendarService(ctx.deps)
  })

  afterEach(() => {
    ctx.connection.close()
  })

  /** 블록 하나를 만든다. 날짜는 [종류, 날짜] 목록 */
  function block(
    id: string,
    dates: Array<['start_date' | 'due_date', string]>,
    task: string | null = `${id} 할 일`
  ): void {
    seedBlock(ctx.repos, id)
    let order = 0
    if (task) seedElement(ctx.repos, `${id}-task`, id, 'task', order++, { value: task })
    dates.forEach(([type, dateValue], index) =>
      seedElement(ctx.repos, `${id}-${type}-${index}`, id, type, order++, { dateValue })
    )
  }

  function listedIds(range = OCTOBER): string[] {
    return service.list(range.from, range.to).map((entry) => entry.blockId)
  }

  describe('조회 기간', () => {
    it('기간 안에 날짜가 있는 블록을 돌려준다', () => {
      block('due', [['due_date', '2026-10-09']])

      expect(service.list(OCTOBER.from, OCTOBER.to)).toEqual([
        {
          blockId: 'due',
          title: 'due 할 일',
          completed: false,
          span: null,
          marks: [
            {
              kind: 'due',
              elementId: 'due-due_date-0',
              date: '2026-10-09',
              time: null,
              needsConfirm: false
            }
          ]
        }
      ])
    })

    it('기간 안에 날짜가 없어도 막대가 기간 전체를 가로지르면 돌려준다', () => {
      block('long', [
        ['start_date', '2026-09-20'],
        ['due_date', '2026-11-10']
      ])

      const [entry] = service.list(OCTOBER.from, OCTOBER.to)

      expect(entry).toMatchObject({
        blockId: 'long',
        span: { start: '2026-09-20', end: '2026-11-10' }
      })
      expect(entry.marks.map((mark) => mark.date)).toEqual(['2026-09-20', '2026-11-10'])
    })

    it('기간과 겹치지 않는 블록은 뺀다', () => {
      block('before', [['due_date', '2026-09-30']])
      block('after', [['start_date', '2026-11-01']])
      block('inside', [['due_date', '2026-10-31']])

      expect(listedIds()).toEqual(['inside'])
    })

    it('뒤집혀 막대가 없고 기간 양쪽에만 날짜가 있는 블록은 뺀다', () => {
      // 가장 이른 날짜 ≤ to, 가장 늦은 날짜 ≥ from이라 후보에는 들지만 실제로는 겹치지 않는다
      block('inverted', [
        ['start_date', '2026-11-10'],
        ['due_date', '2026-09-20']
      ])

      expect(listedIds()).toEqual([])
    })

    it('막대 시작(없으면 첫 표시) 날짜 순으로 돌려준다', () => {
      block('b-late', [['due_date', '2026-10-20']])
      block('a-span', [
        ['start_date', '2026-10-05'],
        ['due_date', '2026-10-25']
      ])
      block('c-early', [['due_date', '2026-10-02']])

      expect(listedIds()).toEqual(['c-early', 'a-span', 'b-late'])
    })
  })

  describe('보여주지 않는 것', () => {
    it('날짜가 없거나 원래 표현만 있는 블록은 뺀다', () => {
      block('no-date', [])
      seedBlock(ctx.repos, 'vague')
      seedElement(ctx.repos, 'vague-due', 'vague', 'due_date', 0, {
        rawText: '다음주쯤',
        needsConfirm: true
      })

      expect(listedIds()).toEqual([])
    })

    it('삭제된 블록은 뺀다 (휴지통 포함)', () => {
      block('trashed', [['due_date', '2026-10-09']])
      ctx.repos.blocks.softDelete('trashed', 'user', SEED_AT)

      expect(listedIds()).toEqual([])
    })

    it('삭제된 날짜 요소는 보지 않는다', () => {
      // 10월 마감일은 삭제됐고, 남은 날짜는 11월뿐
      block('partly', [
        ['due_date', '2026-10-09'],
        ['due_date', '2026-11-20']
      ])
      ctx.repos.elements.softDelete('partly-due_date-0', 'user', SEED_AT)

      expect(listedIds()).toEqual([])
      expect(listedIds({ from: '2026-11-01', to: '2026-11-30' })).toEqual(['partly'])
    })
  })

  describe('항목 글자와 상태', () => {
    it('할 일이 없으면 요청자, 그다음 상세, 모두 없으면 "(할 일 없음)"', () => {
      block('by-requester', [['due_date', '2026-10-09']], null)
      seedElement(ctx.repos, 'r', 'by-requester', 'requester', 5, { value: '김대리' })
      seedElement(ctx.repos, 'd', 'by-requester', 'detail', 6, { value: '단가표' })
      block('by-detail', [['due_date', '2026-10-10']], null)
      seedElement(ctx.repos, 'd2', 'by-detail', 'detail', 5, { value: '단가표 첨부' })
      block('empty', [['due_date', '2026-10-11']], null)

      expect(service.list(OCTOBER.from, OCTOBER.to).map((entry) => entry.title)).toEqual([
        '김대리',
        '단가표 첨부',
        '(할 일 없음)'
      ])
    })

    it('완료한 블록도 돌려주고 완료로 표시한다 (흐리게 그리기용)', () => {
      block('done', [['due_date', '2026-10-09']])
      ctx.repos.blocks.update('done', { completedAt: SEED_AT })

      expect(service.list(OCTOBER.from, OCTOBER.to)[0].completed).toBe(true)
    })

    it('검토 전 블록도 돌려준다', () => {
      block('inbox', [['due_date', '2026-10-09']])

      expect(ctx.repos.blocks.findLiveById('inbox')?.reviewedAt).toBeNull()
      expect(listedIds()).toEqual(['inbox'])
    })
  })
})
