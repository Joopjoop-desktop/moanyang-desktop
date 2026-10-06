import { contextBridge, ipcRenderer } from 'electron'
import {
  DEV_IPC_CHANNELS,
  IPC_CHANNELS,
  type IpcEvent,
  type IpcEvents,
  type JoopjoopApi
} from '@shared/ipc'

/**
 * renderer에는 채널 계약(@shared/ipc)에 있는 함수만 노출한다. ipcRenderer를 통째로 노출하지 않는다.
 * 'block:list' → window.api.block.list(request)
 */
function buildApi(): JoopjoopApi {
  // 개발 전용 채널은 빌드 시점 값으로 걸러, 배포 빌드에는 포함되지 않게 한다. (설계 9.1)
  const channels: readonly string[] = import.meta.env.DEV
    ? [...IPC_CHANNELS, ...DEV_IPC_CHANNELS]
    : IPC_CHANNELS

  const api: Record<string, Record<string, (request: unknown) => Promise<unknown>>> = {}
  for (const channel of channels) {
    const [domain, action] = channel.split(':')
    api[domain] ??= {}
    api[domain][action] = (request) => ipcRenderer.invoke(channel, request)
  }

  const on = <E extends IpcEvent>(
    event: E,
    listener: (payload: IpcEvents[E]) => void
  ): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: IpcEvents[E]): void => listener(payload)
    ipcRenderer.on(event, handler)
    return () => ipcRenderer.removeListener(event, handler)
  }

  return { ...api, on } as unknown as JoopjoopApi
}

contextBridge.exposeInMainWorld('api', buildApi())
