import { describe, expect, it } from 'vitest'
import {
  DRAWER_TEXT,
  drawerText,
  noticeForCompleted,
  noticeForFailed,
  type DrawerState
} from './drawerStatus'

const idle: DrawerState = { dragOver: false, pasteMode: false, notice: null, unfinished: 0 }
const done = { tone: 'done', message: '캘린더에 1개 넣었어요' } as const

describe('서랍 문구 (설계 9.7)', () => {
  it('추출 결과: 넣은 수와 채울 수를 두 줄로, 블록이 없으면 할 일 없음', () => {
    const both = { captureId: 'c1', blockIds: ['b1', 'b2'], toCalendar: 1, needsInput: 1 }

    expect(noticeForCompleted(both)).toEqual({
      tone: 'done',
      message: '캘린더에 1개 넣었어요\n1개는 채워 주세요'
    })
    expect(
      noticeForCompleted({ captureId: 'c1', blockIds: [], toCalendar: 0, needsInput: 0 })
    ).toEqual({ tone: 'empty', message: '할 일이 안 보여요' })
  })

  it('실패: 다시 시도할 수 있으면 스튜디오로 안내한다', () => {
    expect(
      noticeForFailed({ captureId: 'c1', errorCode: 'CAPTURE_EXTRACT_FAILED', canRetry: true })
    ).toEqual({ tone: 'failed', message: '못 넣었어요. 스튜디오에서 다시 시도해 주세요' })
    expect(
      noticeForFailed({ captureId: 'c1', errorCode: 'INTERRUPTED', canRetry: false }).message
    ).toBe('못 넣었어요')
  })

  it('평소에는 안내, 처리 중이면 정리하는 중', () => {
    expect(drawerText(idle)).toEqual({ text: DRAWER_TEXT.idle, tone: null })
    expect(drawerText({ ...idle, unfinished: 2 }).text).toBe(DRAWER_TEXT.working)
  })

  it('끌기·붙여넣기 > 결과 알림 > 처리 중 순서로 보여준다', () => {
    const busy: DrawerState = { dragOver: true, pasteMode: true, notice: done, unfinished: 1 }

    expect(drawerText(busy).text).toBe(DRAWER_TEXT.dragOver)
    expect(drawerText({ ...busy, dragOver: false }).text).toBe(DRAWER_TEXT.paste)
    expect(drawerText({ ...busy, dragOver: false, pasteMode: false })).toEqual({
      text: done.message,
      tone: 'done'
    })
  })
})
