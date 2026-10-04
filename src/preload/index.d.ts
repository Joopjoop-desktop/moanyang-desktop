import type { JoopjoopApi } from '@shared/api'

declare global {
  interface Window {
    api: JoopjoopApi
  }
}
