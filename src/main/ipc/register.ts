import type { IpcMain } from 'electron'
import type { IpcChannel } from '@shared/ipc'
import { handleIpcRequest, type IpcHandlers } from './router'

/**
 * 채널을 ipcMain에 등록한다. 처리 로직은 handleIpcRequest에 있고, 여기는 Electron 연결만 한다.
 * @param channels 등록할 채널. 개발 전용 채널은 개발 모드에서만 넘긴다. (설계 9.1)
 */
export function registerIpcHandlers(
  ipcMain: IpcMain,
  handlers: IpcHandlers,
  channels: readonly IpcChannel[]
): void {
  for (const channel of channels) {
    ipcMain.handle(channel, (_event, raw: unknown) => handleIpcRequest(handlers, channel, raw))
  }
}
