import { MockExtractor } from './mockExtractor'
import { ServerExtractor } from './serverExtractor'
import type { Extractor } from './types'

export type ExtractorSettings = {
  /** .env의 MAIN_VITE_EXTRACT_URL */
  serverUrl: string | undefined
  /** .env의 MAIN_VITE_EXTRACT_KEY */
  serverKey: string | undefined
  /** 개발 모드면 Mock이 처리 중 상태가 보이도록 늦게 응답한다 (설계 8.8) */
  dev: boolean
}

/**
 * 어떤 추출기를 쓸지 정한다. (설계 8.9)
 * 서버 주소가 있으면 ServerExtractor, 없으면 MockExtractor.
 * 서버 없이 개발하는 팀원과 .env 없이 만드는 빌드(맥 체험 빌드 등)는 그대로 Mock을 쓴다.
 */
export function createExtractor(settings: ExtractorSettings): Extractor {
  const serverUrl = settings.serverUrl?.trim()
  if (!serverUrl) return new MockExtractor({ delayMs: settings.dev ? 1_500 : 0 })

  return new ServerExtractor({ baseUrl: serverUrl, apiKey: settings.serverKey?.trim() ?? '' })
}
