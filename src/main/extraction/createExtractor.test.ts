import { describe, expect, it } from 'vitest'
import { createExtractor } from './createExtractor'
import { MockExtractor } from './mockExtractor'
import { ServerExtractor } from './serverExtractor'

describe('createExtractor (설계 8.9)', () => {
  it('서버 주소가 없으면 MockExtractor', () => {
    const extractor = createExtractor({ serverUrl: undefined, serverKey: undefined, dev: false })

    expect(extractor).toBeInstanceOf(MockExtractor)
  })

  it('서버 주소가 공백뿐이어도 MockExtractor', () => {
    const extractor = createExtractor({ serverUrl: '  ', serverKey: 'demo-key', dev: false })

    expect(extractor).toBeInstanceOf(MockExtractor)
  })

  it('서버 주소가 있으면 ServerExtractor', () => {
    const extractor = createExtractor({
      serverUrl: 'http://server.test',
      serverKey: 'demo-key',
      dev: true
    })

    expect(extractor).toBeInstanceOf(ServerExtractor)
  })
})
