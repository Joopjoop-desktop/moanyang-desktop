import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

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
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', '@electron-toolkit/*', 'node:*', 'fs', 'path', 'child_process'],
              message: 'UI는 preload가 노출한 window.api로만 코어를 호출합니다.'
            },
            {
              group: ['**/main/**', '**/preload/**'],
              message:
                'UI는 main/preload 코드를 직접 import하지 않습니다. 공통 타입은 @shared를 사용하세요.'
            }
          ]
        }
      ]
    }
  },
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
