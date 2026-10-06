import type { Services } from '../services'
import type { ServiceDeps } from '../services/deps'
import type { IpcHandlers } from '../ipc/router'
import { noRequest } from '../ipc/schemas'
import { seedSampleBlocks } from './seed'

/** 개발 모드에서만 등록하는 채널 핸들러 (설계 9.1) */
export function createDevIpcHandlers(services: Services, deps: ServiceDeps): IpcHandlers {
  return {
    'dev:seed': {
      schema: noRequest,
      handle: () => seedSampleBlocks(deps).map((blockId) => services.blocks.get(blockId))
    }
  }
}
