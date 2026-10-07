import { BlockService } from './blockService'
import { CaptureService } from './captureService'
import type { ServiceDeps } from './deps'
import { ElementService } from './elementService'
import { LabelService } from './labelService'
import { MoveService } from './moveService'
import { PurgeService } from './purgeService'

export type Services = {
  blocks: BlockService
  captures: CaptureService
  elements: ElementService
  labels: LabelService
  moves: MoveService
  purge: PurgeService
}

/** 서비스 조립(composition root). 앱 시작 시 한 번 만들고 IPC 등록이 받아 쓴다. (설계 9.1) */
export function createServices(deps: ServiceDeps): Services {
  return {
    blocks: new BlockService(deps),
    captures: new CaptureService(deps),
    elements: new ElementService(deps),
    labels: new LabelService(deps),
    moves: new MoveService(deps),
    purge: new PurgeService(deps)
  }
}
