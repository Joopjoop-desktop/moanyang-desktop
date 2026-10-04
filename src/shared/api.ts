/**
 * preload가 renderer에 `window.api`로 노출하는 함수 목록.
 * IPC 채널이 추가되면 여기에 타입을 먼저 정의한다.
 */
export type JoopjoopApi = Record<string, never>
