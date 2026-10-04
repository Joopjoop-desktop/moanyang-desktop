# 줍줍 (Joopjoop) Desktop

흩어진 메시지에서 할 일을 드래그·붙여넣기로 "줍줍"해 블록으로 정리하고 일정으로 만드는 Windows 데스크톱 앱입니다.

카톡, 메일 등 어떤 앱에서든 텍스트를 캐릭터에게 먹이면 AI가 할 일·시작일·마감일·요청자를 뽑아 블록으로 만들고, 사용자는 블록 안의 요소를 끌어 옮기며 합치거나 나눕니다.

> 상세 설계(데이터 모델, 도메인 규칙, 추출 형식, IPC 명세)는 [`docs/design.md`](docs/design.md)를 참고하세요.
> 설계가 바뀌면 코드와 같은 PR에서 문서도 함께 수정합니다.

---

## 기술 스택

| 영역               | 사용 기술                                          |
| ------------------ | -------------------------------------------------- |
| 앱                 | Electron, TypeScript                               |
| UI                 | React                                              |
| 빌드 도구          | electron-vite                                      |
| 로컬 DB            | SQLite (better-sqlite3)                            |
| ORM / 마이그레이션 | Drizzle ORM, drizzle-kit                           |
| 테스트             | Vitest (단위), Playwright (E2E)                    |
| 코드 품질          | ESLint, Prettier, husky + lint-staged              |
| 패키징·배포        | electron-builder, electron-updater, GitHub Actions |
| 대상 OS            | Windows (macOS는 이후)                             |

---

## 시작하기

### 요구 사항

- Node.js 24 LTS 이상 (`.nvmrc` 참고), npm 11 이상
- Windows 10 이상
- (네이티브 모듈 빌드 실패 시) Visual Studio Build Tools의 C++ 빌드 도구

### 설치

```bash
npm install
```

- 설치 후 `postinstall`에서 네이티브 모듈이 Electron 버전에 맞게 자동으로 리빌드됩니다.
- 설치 시 `prepare`가 husky Git hook을 연결합니다. 이후 커밋할 때마다 바뀐 파일에 ESLint·Prettier가 자동 실행되며, 검사를 건너뛰지 않습니다.

### 주요 명령어

| 명령어                  | 설명                                         |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | 개발 모드 실행 (핫 리로드). 종료는 `Ctrl+C`  |
| `npm run start`         | 빌드 결과물로 실행 (배포 빌드 미리보기)      |
| `npm run build`         | 타입 검사 후 프로덕션 빌드 (`out/`)          |
| `npm run build:unpack`  | 설치 파일 없이 패키징만 (`dist/win-unpacked`) |
| `npm run build:win`     | Windows 설치 파일 생성 (`dist/`)             |
| `npm run test`          | 단위 테스트 1회 실행 (Vitest)                |
| `npm run test:watch`    | 단위 테스트 감시 모드                        |
| `npm run lint`          | ESLint 검사 (층 분리 규칙 포함)              |
| `npm run typecheck`     | 타입 검사 (main·preload / renderer)          |
| `npm run format`        | Prettier로 전체 포맷 정리                    |
| `npm run format:check`  | 포맷 검사만                                  |

DB 마이그레이션(`db:generate`)과 E2E 테스트(`test:e2e`) 명령은 해당 기능 구현 시 추가합니다.

### 테스트 작성

- 단위 테스트 파일은 대상 파일 옆에 `*.test.ts`로 둡니다. (예: `src/main/domain/merge.test.ts`)
- 단위 테스트는 Electron 없이 Node에서 실행됩니다. `domain/`과 `services/`가 주 대상입니다.

### 문제 해결

**`npm run dev` 시 `Error: Electron uninstall`**
Electron 실행 파일이 내려받아지지 않은 상태입니다. npm 11은 허용 목록(`package.json`의 `allowScripts`)에 없는 패키지의 설치 스크립트를 실행하지 않습니다. 아래를 실행하면 실행 파일을 직접 내려받습니다.

```bash
node node_modules/electron/install.js
```

**Electron·esbuild 버전을 올린 뒤 설치 스크립트 경고가 나올 때**
`allowScripts`는 버전 단위로 기록됩니다. 버전을 올렸다면 새 버전을 다시 허용합니다.

```bash
npm approve-scripts --allow-scripts-pending
```

### 환경 변수

개발용 LLM API 키 등은 프로젝트 루트의 `.env`에 둡니다. `.env`는 Git에 올라가지 않으며, 필요한 항목은 `.env.example`을 참고합니다.

> 개발용 API 키를 넣은 빌드는 팀 내부에서만 사용하고 외부에 배포하지 않습니다.

---

## 폴더 구조

```
joopjoop-desktop/
├─ src/
│  ├─ main/            # 코어 층 (Electron main process)
│  │  ├─ ipc/          # IPC 핸들러 — UI 요청 수신, 입력 검증, 응답 형식 통일
│  │  ├─ services/     # 비즈니스 로직, 트랜잭션, 이력 기록
│  │  ├─ domain/       # 순수 도메인 로직 (Electron 비의존)
│  │  ├─ repositories/ # 데이터 저장·조회, 소프트 딜리트 필터
│  │  ├─ db/           # Drizzle 스키마, DB 연결, 마이그레이션 실행
│  │  ├─ adapters/     # AI 추출, 캘린더 등 외부 연동
│  │  ├─ os/           # 창, 트레이, 클립보드, 단축키
│  │  └─ infra/        # 로거, 에러 수집, 분석, 설정
│  ├─ preload/         # UI에 허용된 기능만 노출
│  ├─ renderer/        # UI 층 (React)
│  └─ shared/          # IPC 요청·응답 타입, 에러 코드, 공통 타입
├─ drizzle/            # drizzle-kit이 생성한 마이그레이션 SQL
└─ docs/               # 설계 문서
```

---

## 아키텍처 규칙

코드를 작성할 때 반드시 지켜야 하는 규칙입니다.

### 층 분리

- **UI(renderer)는 preload가 노출한 함수로만 코어를 호출합니다.** Node API나 DB에 직접 접근하지 않습니다.
- **외부 통신(AI, 서버, 캘린더)은 코어에서만 합니다.** UI는 외부 API를 직접 호출하지 않습니다.
- Electron 보안 설정: `contextIsolation: true`, `nodeIntegration: false`

### 코어 내부 계층

```
IPC (Controller) → Service → Domain / Repository → DB
                         ↘ Adapter → 외부 API
```

- **모든 데이터 변경은 Service를 거칩니다.** 변경과 이력(History) 기록은 같은 트랜잭션에서 처리합니다.
- **`domain/`은 Electron에 의존하지 않습니다.** Electron 없이 단위 테스트할 수 있어야 합니다.
- 외부 연동(Extractor, CalendarProvider 등)은 **인터페이스로 정의하고 주입**합니다. 목업과 실제 구현을 서비스 코드 수정 없이 교체할 수 있어야 합니다.
- **트랜잭션은 동기입니다.** better-sqlite3 트랜잭션 안에서는 `await`를 쓸 수 없으므로, 비동기 작업은 트랜잭션 밖에서 끝내고 결과 저장만 트랜잭션으로 처리합니다.

### IPC

- 채널 이름은 `도메인:동작` 형식입니다. (예: `block:merge`, `element:move`)
- 요청·응답 타입은 `src/shared`에 정의하고 UI와 코어가 함께 사용합니다.
- 코어는 예외를 던지지 않고 아래 형식으로 감싸 반환합니다.
  ```ts
  type IpcResult<T> =
    { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
  ```
- 에러 코드는 도메인별로 정의하고, 사용자에게 보여줄 문구는 UI가 코드 기준으로 정합니다. 정의되지 않은 에러는 `INTERNAL_ERROR`로 반환합니다.

---

## 데이터 규칙

- **스키마 변경은 반드시 마이그레이션으로 합니다.** `src/main/db`의 스키마를 수정한 뒤 `npm run db:generate`로 SQL을 생성하고 함께 커밋합니다. 생성된 마이그레이션 파일은 직접 수정하지 않습니다.
- **ID는 UUID v7을 사용합니다.**
- **삭제는 소프트 딜리트입니다.** 삭제 여부 필터는 저장소(`repositories/`) 계층에서만 처리합니다. 기본 조회 메서드는 삭제된 데이터를 자동으로 제외하고, 삭제된 데이터까지 봐야 하는 경우(휴지통, 하드 딜리트)만 별도 메서드를 사용합니다.
- **DB 위치:** 개발 모드는 프로젝트 내 `data/`(Git 제외), 배포 빌드는 Electron `userData` 경로입니다.

### 개인정보 원칙

- **메시지 원문은 저장하지 않습니다.** 메모리에서 추출에만 쓰고 즉시 버립니다. DB, 로그, 에러 수집 어디에도 남기지 않습니다.
- 창 제목은 저장하지 않고 앱 이름만 기록합니다.
- 분석 이벤트에는 행동만 기록하고 원문·블록 내용은 포함하지 않습니다.
- 클립보드는 사용자가 붙여넣는 순간에만 읽습니다.

---

## 개발 팁

| 목적                | 방법                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| UI 확인             | 앱 창에서 Chrome 개발자 도구 열기                                                  |
| 코어 기능 직접 호출 | 개발자 도구 콘솔에서 preload가 노출한 함수 호출                                    |
| 코어 디버깅         | VS Code 디버거를 메인 프로세스에 연결 (`.vscode/launch.json`)                      |
| DB 확인             | DB Browser for SQLite 또는 DBeaver로 `data/` 안의 DB 파일 열기 (수정은 앱 종료 후) |
| IPC 명세 확인       | `src/shared`의 타입 정의                                                           |

---

## 협업 규칙

### 브랜치

- `main`: 항상 실행 가능한 상태를 유지합니다.
- 작업 브랜치: `유형/#이슈번호-작업내용` (예: `feat/#12-element-move`)

### 커밋 메시지

`유형: 내용` 형식으로 작성합니다.

| 유형       | 설명                                                 |
| ---------- | ---------------------------------------------------- |
| `feat`     | 새로운 기능                                          |
| `fix`      | 버그 수정                                            |
| `refactor` | 코드 리팩토링                                        |
| `design`   | CSS 등 사용자 UI 디자인 변경                         |
| `style`    | 코드 포맷팅, 코드 변경이 없는 경우                   |
| `chore`    | 빌드 업무 수정, 패키지 매니저 설정, 자잘한 코드 수정 |
| `comment`  | 주석 추가 및 변경                                    |
| `docs`     | 문서 수정                                            |
| `!HOTFIX`  | 급하게 치명적인 버그를 고치는 경우                   |
| `perf`     | 성능 개선                                            |

### 작업 흐름

1. 이슈를 만듭니다.
2. 이슈 번호로 브랜치를 만듭니다.
3. 작업 후 PR을 올립니다. PR에는 관련 이슈 번호(`close #번호`)를 적습니다.
4. 커밋 전 husky가 lint·포맷 검사를 실행합니다. 검사를 건너뛰지 않습니다.
5. 리뷰 후 `main`에 병합합니다.
