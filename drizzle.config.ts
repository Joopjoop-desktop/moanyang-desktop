import { defineConfig } from 'drizzle-kit'

// 스키마 변경 후 `npm run db:generate`로 drizzle/에 마이그레이션 SQL을 만든다.
// 생성된 파일은 직접 수정하지 않는다.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema.ts',
  out: './drizzle'
})
