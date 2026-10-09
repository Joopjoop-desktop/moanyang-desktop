import { pasteProblem } from '../features/capture/captureRules'

/** 놓거나 붙여넣은 것에서 꺼낸 값 */
export type FeedInput = {
  /** 파일·이미지 개수 */
  fileCount: number
  /** text/plain. 없으면 빈 문자열 */
  text: string
}

export type FeedCheck = { ok: true; text: string } | { ok: false; message: string }

export const NOT_TEXT_MESSAGE = '글자만 먹을 수 있어요'

/**
 * 캐릭터에 준 것을 먹일 수 있는지. (설계 9.7)
 * - 파일·이미지가 섞여 있거나 글이 없으면 거절한다
 * - 너무 긴 글은 스튜디오 입력창과 같은 기준으로 거절한다
 * 원문은 고치지 않고 그대로 보낸다(설계 8.2).
 */
export function checkFeed({ fileCount, text }: FeedInput): FeedCheck {
  if (fileCount > 0 || text.trim() === '') return { ok: false, message: NOT_TEXT_MESSAGE }
  const problem = pasteProblem(text)
  return problem ? { ok: false, message: problem } : { ok: true, text }
}

/** 브라우저의 DataTransfer(끌어다 놓기·붙여넣기 공통)에서 값을 꺼낸다 */
export function readTransfer(data: DataTransfer | null): FeedInput {
  if (!data) return { fileCount: 0, text: '' }
  return { fileCount: data.files.length, text: data.getData('text/plain') }
}
