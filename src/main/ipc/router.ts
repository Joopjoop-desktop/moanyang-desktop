import type { z } from 'zod'
import type { IpcChannel, IpcRequest, IpcResponse, IpcResult } from '@shared/ipc'
import type { ErrorCode } from '@shared/errors'
import { DomainError } from '../domain/errors'

/**
 * 채널 하나의 처리: 입력 검증 스키마와 서비스 호출.
 * Electron에 의존하지 않으므로 메모리 DB로 테스트한다. (설계 9.1)
 */
export type ChannelHandler<C extends IpcChannel> = {
  schema: z.ZodType<IpcRequest<C>>
  handle: (request: IpcRequest<C>) => IpcResponse<C> | Promise<IpcResponse<C>>
}

export type IpcHandlers = { [C in IpcChannel]?: ChannelHandler<C> }

/** 사용자에게 내부 정보가 보이지 않도록 INTERNAL_ERROR에는 고정 문구만 넣는다. */
const INTERNAL_MESSAGE = '처리 중 오류가 발생했습니다'

/**
 * 요청 하나를 처리하고 공통 응답 형식으로 감싼다. 예외를 밖으로 던지지 않는다. (설계 9.2)
 * - 입력 검증 실패 → INVALID_INPUT
 * - DomainError → 그 코드 그대로
 * - 그 밖의 예외, 핸들러 없음 → INTERNAL_ERROR (상세는 로그에만)
 */
export async function handleIpcRequest<C extends IpcChannel>(
  handlers: IpcHandlers,
  channel: C,
  raw: unknown
): Promise<IpcResult<IpcResponse<C>>> {
  const handler = handlers[channel] as ChannelHandler<C> | undefined
  if (!handler) {
    console.error(`[ipc] 핸들러가 없는 채널입니다: ${channel}`)
    return failure('INTERNAL_ERROR', INTERNAL_MESSAGE)
  }

  const parsed = handler.schema.safeParse(raw)
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(요청)'}: ${issue.message}`)
      .join('; ')
    return failure('INVALID_INPUT', message)
  }

  try {
    return { ok: true, data: await handler.handle(parsed.data) }
  } catch (error) {
    if (error instanceof DomainError) return failure(error.code, error.message)
    console.error(`[ipc] ${channel} failed`, error)
    return failure('INTERNAL_ERROR', INTERNAL_MESSAGE)
  }
}

type Failure = { ok: false; error: { code: ErrorCode; message: string } }

function failure(code: ErrorCode, message: string): Failure {
  return { ok: false, error: { code, message } }
}
