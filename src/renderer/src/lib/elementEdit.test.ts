import { describe, expect, it } from 'vitest'
import type { ElementView } from '@shared/views'
import { draftFrom, emptyDraft, toCreate, toUpdate } from './elementEdit'

function element(overrides: Partial<ElementView>): ElementView {
  return {
    id: 'e1',
    blockId: 'b1',
    type: 'task',
    value: null,
    dateValue: null,
    timeValue: null,
    rawText: null,
    needsConfirm: false,
    orderIndex: 0,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    ...overrides
  }
}

describe('요소 편집 (설계 9.6)', () => {
  it('글자 요소는 앞뒤 공백을 지워 value로 보낸다', () => {
    const task = element({ value: '견적서 송부' })

    expect(toUpdate(task, { kind: 'text', value: '  견적서 재송부 ' })).toEqual({
      kind: 'save',
      input: { value: '견적서 재송부' }
    })
  })

  it('글자를 비우면 저장하지 않는다', () => {
    const task = element({ value: '견적서 송부' })

    expect(toUpdate(task, { kind: 'text', value: '   ' }).kind).toBe('invalid')
  })

  it('글자가 그대로면 코어를 부르지 않는다', () => {
    const task = element({ value: '견적서 송부' })

    expect(toUpdate(task, draftFrom(task))).toEqual({ kind: 'unchanged' })
  })

  it('날짜 요소는 날짜와 시간을 보내고, 시간을 비우면 null', () => {
    const due = element({ type: 'due_date', dateValue: '2026-10-09', timeValue: '11:00' })

    expect(draftFrom(due)).toEqual({ kind: 'date', dateValue: '2026-10-09', timeValue: '11:00' })
    expect(toUpdate(due, { kind: 'date', dateValue: '2026-10-12', timeValue: '' })).toEqual({
      kind: 'save',
      input: { dateValue: '2026-10-12', timeValue: null }
    })
  })

  it('날짜 요소는 같은 값이어도 보낸다 (확인 필요·원래 표현을 정리하도록)', () => {
    const due = element({
      type: 'due_date',
      dateValue: '2026-10-09',
      rawText: '금요일까지',
      needsConfirm: true
    })

    expect(toUpdate(due, draftFrom(due))).toEqual({
      kind: 'save',
      input: { dateValue: '2026-10-09', timeValue: null }
    })
  })

  it('날짜를 고르지 않으면 저장하지 않는다', () => {
    const due = element({ type: 'due_date', rawText: '다음주쯤', needsConfirm: true })

    expect(draftFrom(due)).toEqual({ kind: 'date', dateValue: '', timeValue: '' })
    expect(toUpdate(due, draftFrom(due)).kind).toBe('invalid')
  })

  describe('새 요소 추가 (설계 7.7)', () => {
    it('종류에 맞는 빈 편집 값으로 시작한다', () => {
      expect(emptyDraft('memo')).toEqual({ kind: 'text', value: '' })
      expect(emptyDraft('due_date')).toEqual({ kind: 'date', dateValue: '', timeValue: '' })
    })

    it('글자는 공백을 지우고, 비어 있으면 만들지 않는다', () => {
      expect(toCreate({ kind: 'text', value: '  내일 전화 ' })).toEqual({
        kind: 'save',
        input: { value: '내일 전화' }
      })
      expect(toCreate({ kind: 'text', value: ' \n ' })).toEqual({ kind: 'empty' })
    })

    it('날짜는 꼭 있어야 하고 시간은 비우면 null, 둘 다 비면 만들지 않는다', () => {
      expect(toCreate({ kind: 'date', dateValue: '2026-10-20', timeValue: '' })).toEqual({
        kind: 'save',
        input: { dateValue: '2026-10-20', timeValue: null }
      })
      expect(toCreate({ kind: 'date', dateValue: '', timeValue: '10:00' }).kind).toBe('invalid')
      expect(toCreate({ kind: 'date', dateValue: '', timeValue: '' })).toEqual({ kind: 'empty' })
    })
  })
})
