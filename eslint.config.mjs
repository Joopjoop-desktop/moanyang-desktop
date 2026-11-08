import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

// 렌더러 전체에 거는 import 제한. flat config에서는 같은 파일에 나중에 걸린
// no-restricted-imports가 앞의 것을 통째로 덮어쓰므로, 폴더별 규칙도 이 목록을 함께 넣는다.
const rendererBasePatterns = [
  {
    group: ['electron', '@electron-toolkit/*', 'node:*', 'fs', 'path', 'child_process'],
    message: 'UI는 preload가 노출한 window.api로만 코어를 호출합니다.'
  },
  {
    group: ['**/main/**', '**/preload/**'],
    message: 'UI는 main/preload 코드를 직접 import하지 않습니다. 공통 타입은 @shared를 사용하세요.'
  },
  {
    group: ['../*', '../**'],
    message: '다른 폴더는 @renderer/... 경로로 import합니다. 같은 폴더만 ./ 를 씁니다.'
  }
]

// 렌더러 안의 의존 방향: app → features → components → api, lib
// features 사이에서는 block이 바닥이고, calendar만 스튜디오 조립을 위해 fill·capture를 쓴다.
const LAYER_MESSAGE =
  '렌더러 의존 방향(app → features → components → api, lib)을 어기는 import입니다. README의 렌더러 구조를 보세요.'
const TESTING_BAN = {
  group: ['@renderer/testing', '@renderer/testing/**'],
  message: 'testing/은 테스트 전용입니다. *.test.ts에서만 import합니다.'
}
const restrict = (patterns) => ({
  rules: { 'no-restricted-imports': ['error', { patterns }] }
})
// dir 아래 파일에 forbidden(@renderer/ 기준 경로) import를 막는다. 앱 코드는 testing/도 막는다.
const rendererLayer = (dir, forbidden) => {
  const layer = forbidden.length
    ? [
        {
          group: forbidden.flatMap((p) => [`@renderer/${p}`, `@renderer/${p}/**`]),
          message: LAYER_MESSAGE
        }
      ]
    : []
  const base = dir ? `src/renderer/${dir}` : 'src/renderer'
  const tests = `${base}/**/*.test.ts`
  return [
    {
      files: [`${base}/**/*.{ts,tsx}`],
      ignores: [tests],
      ...restrict([
        ...rendererBasePatterns,
        ...(dir.includes('testing') ? [] : [TESTING_BAN]),
        ...layer
      ])
    },
    { files: [tests], ...restrict([...rendererBasePatterns, ...layer]) }
  ]
}
const FEATURES = ['block', 'calendar', 'fill', 'capture', 'today']
// feature 하나: 다른 feature 중 allowed만 쓸 수 있다. 안의 lib/는 순수 로직이라
// 같은 feature의 components/, hooks/도 쓰지 않는다.
const featureLayer = (name, allowed) => {
  const forbidden = [
    'app',
    ...FEATURES.filter((f) => f !== name && !allowed.includes(f)).map((f) => `features/${f}`)
  ]
  return [
    ...rendererLayer(`src/features/${name}`, forbidden),
    ...rendererLayer(`src/features/${name}/lib`, [
      ...forbidden,
      `features/${name}/components`,
      `features/${name}/hooks`
    ])
  ]
}

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out', '**/release', '**/coverage'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  // 층 분리 규칙: UI·shared·domain은 Electron/Node에 직접 의존하지 않는다.
  // 뒤에 오는 설정이 같은 파일의 앞 설정을 덮어쓰므로, 넓은 범위부터 좁은 범위 순으로 둔다.
  ...rendererLayer('', []),
  ...featureLayer('block', []),
  ...featureLayer('fill', ['block']),
  ...featureLayer('capture', ['block']),
  ...featureLayer('today', ['block']),
  ...featureLayer('calendar', ['block', 'fill', 'capture']),
  ...rendererLayer('src/components', ['app', 'features']),
  ...rendererLayer('src/api', ['app', 'features', 'components']),
  ...rendererLayer('src/lib', ['app', 'features', 'components']),
  ...rendererLayer('src/testing', ['app', 'features', 'components']),
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', '@electron-toolkit/*', 'node:*', '**/main/**', '**/renderer/**'],
              message: 'shared에는 UI와 코어가 함께 쓰는 순수 타입·상수만 둡니다.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/main/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', '@electron-toolkit/*'],
              message: 'domain은 Electron에 의존하지 않습니다.'
            }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
