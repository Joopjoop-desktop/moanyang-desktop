import { describe, expect, it } from 'vitest'
import { classifyBlock, findMissing } from './blockClassification'
import { makeElement } from './testFactories'

const task = makeElement('t', 'task', { value: '견적서 송부' })
const requester = makeElement('r', 'requester', { value: '김과장' })
const due = makeElement('d', 'due_date', { dateValue: '2026-10-09' })
const start = makeElement('s', 'start_date', { dateValue: '2026-10-05' })
const unsureDue = makeElement('ud', 'due_date', { dateValue: '2026-10-12', needsConfirm: true })
/** 날짜 없이 원래 표현만 ("다음주쯤") */
const vagueDue = makeElement('vd', 'due_date', { dateValue: null, needsConfirm: true })

describe('블록 분류 (설계 7.6)', () => {
  describe('빠진 것', () => {
    it('할 일과 날짜가 있으면 빠진 것이 없다', () => {
      expect(findMissing([task, due])).toEqual([])
    })

    it('시작일만 있어도 날짜가 있는 것으로 본다', () => {
      expect(findMissing([task, start])).toEqual([])
    })

    it('할 일이 없으면 task', () => {
      expect(findMissing([requester, due])).toEqual(['task'])
    })

    it('날짜 없이 원래 표현만 있으면 date (dateConfirm 아님)', () => {
      expect(findMissing([task, vagueDue])).toEqual(['date'])
    })

    it('날짜 중 하나라도 확인 필요면 dateConfirm', () => {
      expect(findMissing([task, start, unsureDue])).toEqual(['dateConfirm'])
    })

    it('날짜가 확인됐으면 원래 표현만 있는 다른 날짜 요소의 확인 필요는 보지 않는다', () => {
      expect(findMissing([task, due, vagueDue])).toEqual([])
    })

    it('여러 개가 빠지면 task → date 순서로 모두', () => {
      expect(findMissing([requester])).toEqual(['task', 'date'])
      expect(findMissing([requester, unsureDue])).toEqual(['task', 'dateConfirm'])
    })
  })

  describe('어느 목록에 나오나', () => {
    it('빠진 것이 없으면 어느 목록에도 나오지 않는다(캘린더에만)', () => {
      expect(classifyBlock([task, due], false)).toEqual({
        missing: [],
        needsInput: false,
        undated: false
      })
    })

    it('날짜가 없고 이대로 두기 안 했으면 채워 주세요', () => {
      expect(classifyBlock([task], false)).toMatchObject({ needsInput: true, undated: false })
    })

    it('할 일이 있고 날짜가 없고 이대로 두기 했으면 날짜 없는 일', () => {
      expect(classifyBlock([task], true)).toMatchObject({ needsInput: false, undated: true })
    })

    it('할 일이 없으면 이대로 두기 했어도 채워 주세요', () => {
      expect(classifyBlock([requester], true)).toMatchObject({ needsInput: true, undated: false })
      expect(classifyBlock([requester, due], true)).toMatchObject({
        needsInput: true,
        undated: false
      })
    })

    it('날짜 확인 필요는 이대로 두기 했어도 채워 주세요', () => {
      expect(classifyBlock([task, unsureDue], true)).toMatchObject({
        needsInput: true,
        undated: false
      })
    })

    it('날짜가 있으면 이대로 두기 여부와 상관없이 목록에 나오지 않는다', () => {
      expect(classifyBlock([task, due], true)).toMatchObject({ needsInput: false, undated: false })
    })
  })
})
