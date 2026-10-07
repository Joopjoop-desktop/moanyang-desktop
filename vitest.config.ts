import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// 단위 테스트는 Electron 없이 Node에서 실행한다 (domain·service, 화면 쪽 순수 계산 대상).
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true
  }
})
