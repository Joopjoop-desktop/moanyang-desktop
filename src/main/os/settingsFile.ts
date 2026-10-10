import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { z } from 'zod'

/**
 * 이 PC에만 의미 있는 설정(예: 오늘 창 위치·높이·투명도)을 JSON 파일에 둔다. (설계 9.7)
 * DB에 넣지 않는 이유: 기기마다 다른 값이고, 이후 동기화 대상도 아니다.
 * 읽기·쓰기에 실패해도 앱은 계속 돌아가야 하므로 예외를 던지지 않고 로그만 남긴다.
 */

const settingsSchema = z.object({
  /** 오늘 창 위치 (7단계 캐릭터 창 때부터 쓰던 이름 그대로) */
  overlay: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  /** 오늘 창 높이·투명도·접힘. 범위는 읽을 때 맞춘다(todayWindowState) */
  today: z
    .object({ height: z.number(), opacity: z.number(), collapsed: z.boolean() })
    .partial()
    .optional()
})

export type AppSettings = z.infer<typeof settingsSchema>

export class SettingsFile {
  constructor(private readonly path: string) {}

  /** 파일이 없거나 형식이 틀리면 빈 설정 */
  read(): AppSettings {
    let raw: string
    try {
      raw = readFileSync(this.path, 'utf8')
    } catch {
      return {}
    }
    try {
      const parsed = settingsSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
      console.warn('[settings] 형식이 틀려 기본값을 씁니다', parsed.error.issues)
    } catch (error) {
      console.warn('[settings] 읽지 못해 기본값을 씁니다', error)
    }
    return {}
  }

  /** 바꾼 항목만 덮어쓴다 */
  update(patch: Partial<AppSettings>): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true })
      writeFileSync(this.path, JSON.stringify({ ...this.read(), ...patch }, null, 2), 'utf8')
    } catch (error) {
      console.error('[settings] 저장 실패', error)
    }
  }
}
