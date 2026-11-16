/// <reference types="electron-vite/node" />

/**
 * .env에서 코어로 들어오는 값. electron-vite가 빌드할 때 MAIN_VITE_로 시작하는 값만 넣는다.
 * 빌드 안에 들어가므로 꺼낼 수 있다. 키를 넣은 빌드는 팀 밖으로 배포하지 않는다 (설계 8.9, 11장)
 */
interface ImportMetaEnv {
  /** 추출 서버 주소. 비우면 MockExtractor */
  readonly MAIN_VITE_EXTRACT_URL?: string
  /** 추출 서버 키 (Authorization: Bearer) */
  readonly MAIN_VITE_EXTRACT_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
