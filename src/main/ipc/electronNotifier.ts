import { BrowserWindow } from 'electron'
import type { IpcEvent, IpcEvents } from '@shared/ipc'
import type { ChangeNotifier } from '../services/deps'

/**
 * 열린 모든 창에 코어 이벤트를 보낸다. (설계 9.4)
 * 커밋이 끝난 뒤 호출되므로, 창이 닫히는 중이라 보내지 못해도 에러를 밖으로 던지지 않는다.
 */
export class ElectronChangeNotifier implements ChangeNotifier {
  blocksChanged(blockIds: string[]): void {
    this.broadcast('blocks:changed', { blockIds })
  }

  captureCompleted(payload: IpcEvents['capture:completed']): void {
    this.broadcast('capture:completed', payload)
  }

  captureFailed(payload: IpcEvents['capture:failed']): void {
    this.broadcast('capture:failed', payload)
  }

  captureUnfinishedChanged(payload: IpcEvents['capture:unfinishedChanged']): void {
    this.broadcast('capture:unfinishedChanged', payload)
  }

  private broadcast<E extends IpcEvent>(event: E, payload: IpcEvents[E]): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed() || window.webContents.isDestroyed()) continue
      try {
        window.webContents.send(event, payload)
      } catch (error) {
        console.error(`[notifier] ${event} 전송 실패`, error)
      }
    }
  }
}
