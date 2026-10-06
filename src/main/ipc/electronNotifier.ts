import { BrowserWindow } from 'electron'
import type { IpcEvents } from '@shared/ipc'
import type { ChangeNotifier } from '../services/deps'

/**
 * 열린 모든 창에 blocks:changed를 보낸다. (설계 9.4)
 * 커밋이 끝난 뒤 호출되므로, 창이 닫히는 중이라 보내지 못해도 에러를 밖으로 던지지 않는다.
 */
export class ElectronChangeNotifier implements ChangeNotifier {
  blocksChanged(blockIds: string[]): void {
    const payload: IpcEvents['blocks:changed'] = { blockIds }
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed() || window.webContents.isDestroyed()) continue
      try {
        window.webContents.send('blocks:changed', payload)
      } catch (error) {
        console.error('[notifier] blocks:changed 전송 실패', error)
      }
    }
  }
}
