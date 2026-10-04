import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// 단위 테스트는 Electron 없이 Node에서 실행한다 (domain·service 대상).
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true
  }
})
