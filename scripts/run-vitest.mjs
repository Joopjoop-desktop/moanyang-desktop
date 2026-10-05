// Vitest를 Electron의 Node로 실행한다. (설계 12장)
// better-sqlite3가 Electron용으로 빌드되어 있어 일반 Node에서는 불러올 수 없기 때문이다.
// 사용: node scripts/run-vitest.mjs [vitest 인자...]
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

// Node에서 require('electron')은 Electron 실행 파일 경로를 돌려준다.
const electronPath = require('electron')
const vitestEntry = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

const result = spawnSync(electronPath, [vitestEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}
process.exit(result.status ?? 1)
