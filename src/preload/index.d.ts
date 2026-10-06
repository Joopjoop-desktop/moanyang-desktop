import type { JoopjoopApi } from '@shared/ipc'

declare global {
  interface Window {
    api: JoopjoopApi
  }
}
