import type { CalendarEntryView } from './calendar'
import type { CaptureErrorCode, CaptureView } from './captures'
import type { UpdateElementInput } from './elements'
import type { ErrorCode } from './errors'
import type { CaptureMethod } from './model'
import type {
  ConflictCheckInput,
  ConflictPreview,
  ConflictResolution,
  MoveResult,
  MoveTarget
} from './moves'
import type { AttachedLabelView, BlockListFilter, BlockView, ElementView, LabelView } from './views'

/**
 * IPC 채널 계약. (설계 9장)
 * preload 함수(window.api)와 코어 핸들러 타입이 모두 이 계약에서 나온다.
 * 채널을 추가할 때는 IpcContract와 아래 채널 목록을 함께 고친다. 빠뜨리면 타입 에러가 난다.
 */

/** 공통 응답 형식 (설계 9.2) */
export type IpcResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }

type Contract<Req, Res> = { request: Req; response: Res }

export type IpcContract = {
  /** 먹이 주기. 바로 pending으로 응답하고 추출은 비동기 (설계 8.1) */
  'capture:submit': Contract<{ text: string; method: CaptureMethod }, CaptureView>
  /** 실패한 먹이 다시 시도 (원문이 메모리에 있을 때만) */
  'capture:retry': Contract<{ captureId: string }, CaptureView>
  /** 실패 카드 목록 */
  'capture:listFailed': Contract<void, CaptureView[]>
  /** 실패 카드 닫기 */
  'capture:dismiss': Contract<{ captureId: string }, null>
  /** 전체 미완료 먹이 수: 대기 + 처리 중 + 자동 재시도 대기 (설계 9.4) */
  'capture:unfinishedCount': Contract<void, { count: number }>

  'block:list': Contract<{ filter: BlockListFilter }, BlockView[]>
  'block:get': Contract<{ blockId: string }, BlockView>
  'block:merge': Contract<
    { sourceBlockId: string; targetBlockId: string; resolution?: ConflictResolution },
    MoveResult
  >
  'block:review': Contract<{ blockId: string; reviewed: boolean }, BlockView>
  'block:complete': Contract<{ blockId: string }, BlockView>
  'block:reopen': Contract<{ blockId: string }, BlockView>
  'block:delete': Contract<{ blockId: string }, null>
  'block:restore': Contract<{ blockId: string }, BlockView>

  'element:create': Contract<{ blockId: string; value: string }, ElementView>
  'element:update': Contract<{ elementId: string } & UpdateElementInput, ElementView>
  'element:confirm': Contract<{ elementId: string }, ElementView>
  'element:delete': Contract<{ elementId: string }, null>
  'element:move': Contract<{ elementId: string; to: MoveTarget }, MoveResult>
  'element:checkConflict': Contract<ConflictCheckInput, ConflictPreview>

  'label:list': Contract<void, LabelView[]>
  'label:attach': Contract<{ blockId: string; labelId: string }, AttachedLabelView[]>
  'label:detach': Contract<{ blockId: string; labelId: string }, AttachedLabelView[]>

  /** 기간(from~to, YYYY-MM-DD, 양 끝 포함)과 겹치는 블록의 달력 표시 (설계 7.5) */
  'calendar:list': Contract<{ from: string; to: string }, CalendarEntryView[]>

  /** 스튜디오 창 열기 (캐릭터 더블클릭, 설계 9.7) */
  'window:openStudio': Contract<void, null>

  /** 개발 모드 전용: 콘솔 확인용 샘플 블록 생성 */
  'dev:seed': Contract<void, BlockView[]>
}

export type IpcChannel = keyof IpcContract
export type IpcRequest<C extends IpcChannel> = IpcContract[C]['request']
export type IpcResponse<C extends IpcChannel> = IpcContract[C]['response']

/** 배포 빌드에도 있는 채널 */
export const IPC_CHANNELS = [
  'capture:submit',
  'capture:retry',
  'capture:listFailed',
  'capture:dismiss',
  'capture:unfinishedCount',
  'block:list',
  'block:get',
  'block:merge',
  'block:review',
  'block:complete',
  'block:reopen',
  'block:delete',
  'block:restore',
  'element:create',
  'element:update',
  'element:confirm',
  'element:delete',
  'element:move',
  'element:checkConflict',
  'label:list',
  'label:attach',
  'label:detach',
  'calendar:list',
  'window:openStudio'
] as const satisfies readonly IpcChannel[]

/** 개발 모드에서만 등록·노출하는 채널 */
export const DEV_IPC_CHANNELS = ['dev:seed'] as const satisfies readonly IpcChannel[]

// 계약에 있는 채널이 두 목록 어디에도 없으면 여기서 타입 에러가 난다.
type MissingChannel = Exclude<
  IpcChannel,
  (typeof IPC_CHANNELS)[number] | (typeof DEV_IPC_CHANNELS)[number]
>
export const ALL_CHANNELS_LISTED: [MissingChannel] extends [never] ? true : MissingChannel = true

/** 코어 → UI 이벤트 (설계 9.4) */
export type IpcEvents = {
  'blocks:changed': { blockIds: string[] }
  /** 추출 완료. blockIds가 빈 배열이면 할 일 없음 (설계 8.1) */
  /**
   * 추출 완료 (설계 8.1). toCalendar: 빠진 것이 없어 바로 캘린더에 들어간 블록 수,
   * needsInput: 채워 주세요로 간 블록 수. 둘의 합은 blockIds 길이와 같다
   */
  'capture:completed': {
    captureId: string
    blockIds: string[]
    toCalendar: number
    needsInput: number
  }
  'capture:failed': { captureId: string; errorCode: CaptureErrorCode; canRetry: boolean }
  /** 미완료 먹이 수가 바뀜 (설계 9.4) */
  'capture:unfinishedChanged': { count: number }
}
export type IpcEvent = keyof IpcEvents

/* window.api 모양: 'block:list' → window.api.block.list(request) */

type DomainOf<C extends string> = C extends `${infer D}:${string}` ? D : never
type ActionOf<C extends string, D extends string> = C extends `${D}:${infer A}` ? A : never

type ApiFunction<C extends IpcChannel> = (
  request: IpcRequest<C>
) => Promise<IpcResult<IpcResponse<C>>>

type ApiFor<Channels extends IpcChannel> = {
  [D in DomainOf<Channels>]: {
    [C in Channels as ActionOf<C, D>]: ApiFunction<C>
  }
}

export type JoopjoopApi = ApiFor<(typeof IPC_CHANNELS)[number]> &
  /** 개발 빌드에만 있음 */
  Partial<ApiFor<(typeof DEV_IPC_CHANNELS)[number]>> & {
    /** 이벤트 구독. 돌려준 함수를 호출하면 구독을 해제한다. */
    on<E extends IpcEvent>(event: E, listener: (payload: IpcEvents[E]) => void): () => void
  }
