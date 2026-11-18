# 줍줍 (Joopjoop) Desktop

흩어진 메시지에서 할 일을 "줍줍"해 캘린더로 옮겨 주는 Windows 데스크톱 앱입니다.

카톡·메일 등 어떤 앱에서든 글을 끌어다 놓거나 붙여넣으면(= **먹이 주기**) AI가 할 일·시작일·마감일·요청자를 뽑아 **블록**으로 만듭니다. 할 일과 날짜가 있으면 사람 손 없이 바로 캘린더에 들어가고, 빠진 것이 있는 블록만 "채워 주세요" 목록에 모입니다.

| 문서                                         | 내용                                                         |
| -------------------------------------------- | ------------------------------------------------------------ |
| [`docs/features.md`](docs/features.md)       | 기획·디자인용 기능 명세: 화면, 기능, 사용 흐름, 화면 문구    |
| [`docs/design.md`](docs/design.md)           | **기준 문서.** 데이터 모델, 도메인 규칙, IPC 명세, 개발 순서 |
| [`docs/development.md`](docs/development.md) | 콘솔에서 코어 호출, DB 작업, 디버깅, 문제 해결               |
| [`docs/mac-trial.md`](docs/mac-trial.md)     | 맥 체험 빌드: Actions로 빌드·전달, 설치 안내, 체크 목록      |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)         | 브랜치·커밋·이슈·PR 흐름                                     |

> 설계가 바뀌면 코드와 같은 PR에서 `docs/design.md`도 함께 고칩니다.

---

## 지금 상태

- 개발 순서([설계 13.1](docs/design.md))의 **0~10단계 완료**. 다음은 11단계(실제 AI 추출), 12단계(E2E 테스트·배포 정리).
- 지금 추출은 **규칙으로 동작하는 가짜 추출기(`MockExtractor`)** 입니다. 11단계에서 실제 LLM 호출로 바뀝니다. Mock 규칙은 [개발 가이드](docs/development.md#먹이-주기-mock-추출)에 있습니다.
- Windows만 지원합니다(macOS는 이후).

### 화면 구성

```
 스튜디오 창 (X = 숨기기)                                   오늘 창 (항상 위)
┌──────────────────────────────────────────────────┐   ┌────────────────┐
│ 먹이 칸(붙여넣기) · 실패 카드                    │   │ 오늘 10/10 ⚙ ▾ │
├───────────────────────────────┬──────────────────┤   ├────────────────┤
│ 캘린더 (월간)                 │ 채워 주세요 N    │   │ ☐ 11:00 회의…  │
│                               │ 날짜 없는 일 M   │   │ ☐ 분기 보고서  │
│                               │ (누르면 카드)    │   ├────────────────┤
└───────────────────────────────┴──────────────────┘   │ ▤ 서랍(먹이)   │
                                                       └────────────────┘
 트레이 아이콘: 스튜디오 열기 / 오늘 창 숨기기·보이기 / 종료
```

---

## 빠른 시작

Windows 10 이상에서 아래를 **순서대로** 따라 합니다. 명령은 PowerShell이나 Git Bash 어디서 실행해도 됩니다.

### 1. 도구 설치 (PC에 한 번만)

| 도구                        | 버전          | 확인 명령       |
| --------------------------- | ------------- | --------------- |
| Git                         | 아무 최신     | `git --version` |
| Node.js (`.nvmrc`)          | **24.x 이상** | `node -v`       |
| npm (Node 24에 함께 들어옴) | **11.x 이상** | `npm -v`        |
| VS Code                     | 아무 최신     | —               |

이미 있으면 확인 명령으로 버전만 봅니다. 없으면 winget으로 설치합니다.

```bash
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS -e
winget install --id Microsoft.VisualStudioCode -e
```

- 설치한 뒤에는 **터미널을 새로 열어야** `node`, `git` 명령이 잡힙니다.
- 다른 프로젝트 때문에 Node 버전을 여러 개 써야 하면 nvm-windows(`winget install --id CoreyButler.NVMforWindows -e`)로 `nvm install 24`, `nvm use 24`를 실행합니다.
- `node -v`가 `v24`보다 낮거나 `npm -v`가 `11`보다 낮으면 다음 단계에서 설치가 바로 멈춥니다(`.npmrc`의 `engine-strict`). 버전부터 맞춥니다.

### 2. 받기

zip으로 받지 말고 **Git으로 clone**합니다. 설치 중에 커밋 검사(husky)를 Git에 연결하기 때문입니다. 개발 기준 브랜치는 `develop`입니다.

```bash
git clone https://github.com/Joopjoop-desktop/joopjoop-desktop.git
cd joopjoop-desktop
git checkout develop
```

### 3. 설치

```bash
npm ci
```

- `npm install`이 아니라 **`npm ci`** 입니다. `package-lock.json`에 적힌 버전 그대로 설치해서 모두 같은 Electron(44.5.1)을 씁니다.
- 설치가 끝나면 자동으로 ① better-sqlite3를 Electron용으로 다시 빌드(`postinstall`)하고 ② 커밋 검사를 연결(`prepare`)합니다.
- `npm install`은 패키지를 추가하거나 버전을 올릴 때만 씁니다(`.npmrc`의 `save-exact`로 정확한 버전이 기록됩니다). 그 뒤 바뀐 `package.json`과 `package-lock.json`을 함께 커밋합니다.

### 4. 확인

```bash
npm run test
```

모든 테스트가 통과하면 설치가 제대로 된 것입니다. 실패하면 [문제 해결](docs/development.md#문제-해결)을 봅니다(대부분 Electron 실행 파일 또는 better-sqlite3 빌드 문제).

### 5. 실행

```bash
npm run dev
```

- 스튜디오 창과 화면 오른쪽 위의 오늘 창이 함께 뜹니다. 개발 DB는 `data/joopjoop.db`에 자동으로 만들어집니다.
- 직접 먹여 보기: 스튜디오 맨 위 먹이 칸에 `견적서 송부 2026-10-20 11:00`을 붙여넣고 "먹이 주기" → 캘린더 10월 20일에 생깁니다. 상황별 예시 글 10가지는 [따라 해 보기](docs/development.md#따라-해-보기)에 있습니다.
- 샘플 데이터 한 번에 넣기: 스튜디오에서 F12 → 콘솔에 `await window.api.dev.seed()` (분류별 샘플 블록 9개).
- 끄기: 터미널에서 `Ctrl+C`, 또는 트레이 아이콘 → 종료.

### 6. VS Code

폴더를 VS Code로 열면 오른쪽 아래에 **권장 확장 설치** 안내가 뜹니다. 설치합니다(ESLint, Prettier, EditorConfig).

- 저장할 때 Prettier로 자동 정리되고 ESLint가 고칠 수 있는 것을 고칩니다(`.vscode/settings.json`).
- 줄바꿈은 LF, 들여쓰기 2칸입니다(`.editorconfig`, `.gitattributes`).
- 코어(main process) 디버깅은 실행 구성 **Debug All**을 씁니다.

### (필요할 때만) 네이티브 빌드 도구

3단계에서 better-sqlite3 빌드 에러(`gyp ERR!`, `MSBuild` 등)가 날 때만 설치합니다. 보통은 미리 빌드된 파일을 받아서 필요 없습니다.

```bash
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
winget install --id Python.Python.3.12 -e
```

설치한 뒤 터미널을 새로 열고 `npm ci`를 다시 실행합니다.

### 주요 명령어

| 명령어                 | 설명                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | 개발 모드 실행(화면 코드는 저장하면 바로 반영). 종료 `Ctrl+C` |
| `npm run test`         | 단위 테스트 1회 (Vitest, Electron의 Node로 실행)              |
| `npm run test:watch`   | 단위 테스트 감시 모드                                         |
| `npm run typecheck`    | 타입 검사 (main·preload / renderer)                           |
| `npm run lint`         | ESLint 검사 (층 분리 규칙 포함)                               |
| `npm run format`       | Prettier로 전체 포맷 정리 (`format:check`는 검사만)           |
| `npm run db:generate`  | 스키마 변경 → 마이그레이션 SQL 생성 (`drizzle/`)              |
| `npm run build`        | 타입 검사 후 빌드 (`out/`). `npm run start`로 빌드 결과 실행  |
| `npm run build:unpack` | 설치 파일 없이 패키징 (`dist/win-unpacked`)                   |
| `npm run build:win`    | Windows 설치 파일 생성 (`dist/`)                              |
| `npm run build:mac`    | 맥 설치 파일(.dmg) 생성. 맥에서만 동작 (보통은 Actions에서)   |

PR을 올리기 전에 `test`, `typecheck`, `lint` 세 개를 통과시킵니다.

### 자주 걸리는 것

| 상황                                 | 이유·방법                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `npm run dev`를 또 켰는데 창이 안 뜸 | 앱은 하나만 실행됩니다. 두 번째 실행은 기존 스튜디오만 앞으로 가져옵니다.                 |
| 창 X를 눌러도 앱이 안 꺼짐           | X는 숨기기입니다. 진짜 종료는 트레이 아이콘 → 종료, 또는 터미널에서 `Ctrl+C`.             |
| 오늘 창의 개발자 도구                | 오늘 창을 한 번 클릭해 초점을 준 뒤 F12.                                                  |
| 데이터를 처음부터 다시               | 앱을 끄고 `data/joopjoop.db*` 삭제. 오늘 창 위치·높이·투명도는 `data/settings.json` 삭제. |
| `npx vitest`로 DB 테스트가 실패      | `npm run test`로 실행합니다(better-sqlite3가 Electron용으로 빌드되어 있음).               |

---

## 먹이가 블록이 되기까지

```
서랍 / 스튜디오 먹이 칸
  │ window.api.capture.submit({ text, method })        ← 원문은 메모리에만 (DB에 저장 안 함)
  ▼
ExtractionQueue (services/extractionQueue.ts)          ← 순차 처리, 실패 시 2·10·30초 자동 재시도
  │ Extractor.extract()  ← 지금은 MockExtractor, 11단계에서 실제 LLM
  ▼
CaptureService.complete → 블록·요소 저장 (한 트랜잭션, History 기록)
  │ 커밋 후 이벤트: blocks:changed → capture:completed { toCalendar, needsInput }
  ▼
화면: 캘린더·채워 주세요·오늘 창이 다시 불러옴, 서랍·알림에 "캘린더에 N개 넣었어요"
```

---

## 코드 지도

```
src/
├─ main/                  # 코어 (Electron main process)
│  ├─ index.ts            # 시작: DB → 서비스 조립 → IPC 등록 → 창·트레이
│  ├─ ipc/                # 채널 핸들러, zod 입력 검증, 응답 형식, 이벤트 보내기
│  ├─ services/           # 트랜잭션·History·변경 알림, 추출 큐
│  ├─ domain/             # 순수 계산 (Electron·DB 비의존): 이동·충돌·분류·달력 표시
│  ├─ repositories/       # DB 조회·저장, 소프트 딜리트 필터
│  ├─ db/                 # Drizzle 스키마, 연결, 마이그레이션 실행, 시스템 라벨
│  ├─ extraction/         # Extractor 인터페이스, MockExtractor, 출력 검증
│  ├─ os/                 # 창(스튜디오·오늘 창), 트레이, 종료 확인, 설정 파일
│  ├─ dev/                # 개발 모드 전용 (dev:seed)
│  └─ infra/              # newId(), nowIso()
├─ preload/               # window.api 노출 (계약에 있는 채널만)
├─ shared/                # UI·코어 공통: IPC 계약(ipc.ts), 에러 코드, 화면용 타입
└─ renderer/src/          # 화면 (React)
   ├─ app/studio/         # 스튜디오 진입점(index.html)과 셸 StudioApp
   ├─ app/today/          # 오늘 창 진입점(overlay.html)과 셸 TodayApp
   ├─ features/           # 기능별 폴더. 안은 components/(화면) · hooks/ · lib/(순수 로직 + 테스트)
   │  ├─ block/           # 블록 카드, 요소 편집·추가, 라벨, 충돌 선택 창, lib/dnd(드래그 규칙), lib/conflict
   │  ├─ calendar/        # 월간 달력, 오른쪽 패널, 날짜 넣기 (fill·capture를 조립)
   │  ├─ fill/            # 채워 주세요·날짜 없는 일 목록, 목록 안 드래그
   │  ├─ capture/         # 먹이 칸, 실패 카드, 완료 알림
   │  └─ today/           # 오늘 창: 오늘 할 일, 서랍
   ├─ components/         # 공용 UI: ui/Checkbox, toast/(아래 알림)
   ├─ api/                # unwrap, TanStack Query, 코어 이벤트 → 다시 불러오기
   ├─ lib/                # 날짜(dates), 표시 문자열, 요소 편집 값, 먹이 결과 문구
   └─ testing/            # 테스트 전용 픽스처
drizzle/                  # drizzle-kit이 만든 마이그레이션 SQL (직접 수정 금지)
data/                     # 개발 DB·설정 (Git 제외)
```

### 이걸 바꾸려면 어디를 고치나

| 하고 싶은 것            | 고칠 곳 (순서대로)                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| IPC 채널 추가           | `shared/ipc.ts`의 `IpcContract`·`IPC_CHANNELS` → `main/ipc/schemas.ts` → `main/ipc/handlers.ts` → 서비스 → `handlers.test.ts`           |
| 코어 → 화면 이벤트 추가 | `shared/ipc.ts`의 `IpcEvents` → `services/deps.ts`의 `ChangeNotifier`·`ipc/electronNotifier.ts` → `renderer/src/api/events.ts`          |
| 에러 코드 추가          | `shared/errors.ts` → `renderer/src/api/errorMessages.ts`(문구, 빠뜨리면 타입 에러)                                                      |
| 도메인 규칙             | `main/domain/` (분류 `blockClassification`, 요소 추가 `elementAdd`, 이동 `moves`, 충돌 `conflicts`, 달력 `calendar`) + 옆 테스트        |
| 요소 종류 추가          | `shared/model.ts`의 `ELEMENT_TYPES` → `domain/elementRules.ts`(규칙·순서) → `lib/display.ts`(이름)                                      |
| 스키마 변경             | `main/db/schema.ts` → `npm run db:generate` → 생성된 SQL 확인 → 같은 커밋 ([DB 작업](docs/development.md#db-작업))                      |
| 스튜디오 화면           | `renderer/src/app/studio/StudioApp.tsx` → `features/calendar`, `features/fill`, `features/block`                                        |
| 오늘 창 화면            | `renderer/src/app/today/TodayApp.tsx` → `features/today` (`TodayHeader`·`TodayList`(줄 계산 `todayRows`)·`Drawer`(문구 `drawerStatus`)) |
| 창 크기·위치·트레이     | `main/os/` (`windows.ts`, `overlayPosition.ts`, `todayWindowState.ts`, `trayMenu.ts`)                                                   |
| 추출기 교체 (11단계)    | `main/extraction/types.ts`의 `Extractor` 구현 → `main/index.ts`에서 큐에 주입. 출력 검증 `parseOutput.ts`는 그대로 거침                 |

---

## 꼭 지킬 규칙

**층 분리** (ESLint가 일부를 막습니다)

- 화면(renderer)은 `window.api`로만 코어를 부릅니다. Node·Electron·DB·`main/` 코드를 직접 import하지 않습니다.
- 외부 통신(AI, 서버, 캘린더)은 코어에서만 합니다.
- `shared/`에는 UI와 코어가 함께 쓰는 순수 타입·상수만 둡니다.

**코어 내부**

```
IPC → Service → Domain / Repository → DB
            ↘ Extractor 등 외부 연동 (인터페이스로 주입)
```

- 모든 데이터 변경은 Service를 거치고, 변경과 History 기록은 같은 트랜잭션에서 합니다. 변경 알림은 커밋 뒤에 보냅니다.
- `domain/`은 계산만 합니다. DB 반영은 서비스가 합니다.
- 트랜잭션은 동기입니다. `await`는 트랜잭션 밖에서 끝냅니다.
- IPC 입력은 `ipc/schemas.ts`의 zod로 검사하고, 응답은 항상 `{ ok: true, data } | { ok: false, error: { code, message } }`입니다. 사용자 문구는 화면이 에러 코드로 정합니다.

**데이터**

- 스키마는 마이그레이션으로만 바꿉니다. `main`·`develop`에 병합된 마이그레이션은 지우거나 고치지 않습니다.
- ID는 `newId()`(UUID v7), 시각은 `nowIso()`(UTC ISO)로만 만듭니다. 날짜 요소(`dateValue`, `timeValue`)는 달력 날짜라 UTC로 바꾸지 않습니다.
- 삭제는 소프트 딜리트이고, 삭제 필터는 `repositories/`에서만 처리합니다(30일 뒤 하드 딜리트).
- 종류 값의 허용 목록은 `shared/model.ts`, 시스템 라벨은 `key`로 찾습니다(`db/systemLabels.ts`).

**개인정보**

- **메시지 원문은 저장하지 않습니다.** 추출 큐의 메모리에만 두고, DB·로그·에러 수집 어디에도 남기지 않습니다.
- 클립보드는 사용자가 붙여넣는 순간에만 읽습니다. 창 제목은 저장하지 않습니다.
- 개발용 API 키는 `.env`(Git 제외)에 두고, 키가 들어간 빌드는 외부에 배포하지 않습니다.

**테스트**

- 테스트 파일은 대상 옆에 `*.test.ts`로 둡니다. 도메인·서비스·IPC는 Vitest로 꼼꼼히, 화면은 **순수 계산만** 테스트합니다(예: `todayRows`, `toastStack`).
- 컴포넌트를 그리는 테스트는 12단계 E2E(Playwright)에서 합니다.
- 서비스 테스트는 `services/testSupport.ts`(메모리 DB, 고정 시계, 가짜 알림)를 씁니다.

**코드 모양:** 줄 길이 100자(Prettier). 커밋 때 lint-staged가 ESLint·Prettier를 자동 실행합니다.

---

## 기술 스택

| 영역      | 사용 기술                                                     |
| --------- | ------------------------------------------------------------- |
| 앱        | Electron 44, TypeScript                                       |
| 화면      | React 19, TanStack Query, dnd-kit, Tailwind CSS v4 + CSS 변수 |
| 빌드      | electron-vite, electron-builder                               |
| 로컬 DB   | SQLite (better-sqlite3), Drizzle ORM·drizzle-kit              |
| 입력 검증 | zod                                                           |
| 테스트    | Vitest (단위). Playwright(E2E)는 12단계                       |
| 코드 품질 | ESLint, Prettier, husky + lint-staged                         |
| 대상 OS   | Windows (macOS는 이후)                                        |
