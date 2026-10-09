import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsFile } from './settingsFile'

describe('설정 파일 (설계 9.7)', () => {
  let dir: string
  let path: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'joopjoop-settings-'))
    path = join(dir, 'nested', 'settings.json')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('파일이 없으면 빈 설정', () => {
    expect(new SettingsFile(path).read()).toEqual({})
  })

  it('저장한 위치를 다시 읽는다 (폴더가 없으면 만든다)', () => {
    const settings = new SettingsFile(path)

    settings.update({ overlay: { x: 100, y: 200 } })

    expect(settings.read()).toEqual({ overlay: { x: 100, y: 200 } })
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ overlay: { x: 100, y: 200 } })
  })

  it('형식이 틀리거나 JSON이 깨져 있으면 빈 설정', () => {
    const settings = new SettingsFile(join(dir, 'settings.json'))

    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ overlay: { x: 'left' } }))
    expect(settings.read()).toEqual({})

    writeFileSync(join(dir, 'settings.json'), '{ broken')
    expect(settings.read()).toEqual({})
  })
})
