# 개발 가이드

README의 [빠른 시작](../README.md#빠른-시작)을 마친 뒤 보는 문서입니다. 규칙과 명세는 [`design.md`](design.md)가 기준입니다.

- [개발 도구](#개발-도구)
- [콘솔에서 코어 호출하기](#콘솔에서-코어-호출하기)
- [먹이 주기 (Mock 추출)](#먹이-주기-mock-추출)
- [DB 작업](#db-작업)
- [문제 해결](#문제-해결)

---

## 개발 도구

| 목적                | 방법                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| 화면 확인           | 창에서 F12 → Chrome 개발자 도구. 오늘 창은 한 번 클릭해 초점을 준 뒤 F12   |
| 코어 기능 직접 호출 | 개발자 도구 콘솔에서 `window.api` 호출 ([아래](#콘솔에서-코어-호출하기))   |
| 코어 디버깅         | VS Code 실행 구성 **Debug All**(메인 + 화면 동시에, `.vscode/launch.json`) |
| 코어 로그           | `npm run dev`를 실행한 터미널 (`[db]`, `[capture]`, `[ipc]` 등)            |
| DB 확인             | DBeaver 읽기 전용 연결로 `data/joopjoop.db` ([아래](#db-작업))             |
| IPC 명세            | `src/shared/ipc.ts`의 `IpcContract`(요청·응답), `IpcEvents`(이벤트)        |

---

## 콘솔에서 코어 호출하기

`npm run dev`로 실행한 뒤 스튜디오 창에서 F12 → 콘솔에 입력합니다. Postman 대신 쓰는 방법입니다.

- 채널 `도메인:동작`은 `window.api.도메인.동작(요청)`으로 부릅니다. (예: `block:list` → `window.api.block.list`)
- 모든 호출은 `{ ok: true, data }` 또는 `{ ok: false, error: { code, message } }`를 돌려줍니다.
- `dev:*`는 개발 모드에만 있습니다. 배포 빌드에는 코드 자체가 없습니다.

```js
// 샘플 블록 9개 (캘린더에만 / 채워 주세요 / 날짜 없는 일이 섞여 있음)
const { data: seeded } = await window.api.dev.seed()

// 변경 이벤트 구독 (데이터가 바뀌면 바뀐 블록 ID가 찍힘)
const off = window.api.on('blocks:changed', (e) => console.log('changed', e.blockIds))

// 목록: needsInput(채워 주세요) / undated(날짜 없는 일) / all / completed / trash
await window.api.block.list({ filter: 'needsInput' })

// 오늘~오늘 달력 표시 (오늘 창이 쓰는 조회)
await window.api.calendar.list({ from: '2026-10-10', to: '2026-10-10' })

// 요소 추가: 종류 + 값. 할 일·시작일·마감일·요청자는 없을 때만 (샘플 6은 날짜가 없음)
await window.api.element.create({
  blockId: seeded[5].id,
  type: 'due_date',
  dateValue: '2026-10-20',
  timeValue: null
})

// 블록 합치기: 미리보기 → 충돌이 있으면 남길 요소를 골라 미리보기 결과와 함께 보냄
// (샘플 1과 3은 할 일·마감일·요청자가 겹쳐 충돌 선택을 해볼 수 있음)
const { data: preview } = await window.api.element.checkConflict({
  kind: 'block',
  sourceBlockId: seeded[2].id,
  targetBlockId: seeded[0].id
})
const selection = Object.fromEntries(preview.groups.map((g) => [g.type, [g.existing[0].id]]))
await window.api.block.merge({
  sourceBlockId: seeded[2].id,
  targetBlockId: seeded[0].id,
  resolution: { selection, previewed: preview }
})

// 요소 이동: reorder(같은 블록 안) / block(다른 블록) / new(분리)
// 샘플 9의 메모를 샘플 2로 (메모는 겹쳐도 충돌이 아님)
await window.api.element.move({
  elementId: seeded[8].elements[1].id,
  to: { kind: 'block', blockId: seeded[1].id }
})

// 오늘 창 상태 (오늘 창 콘솔에서): 투명도 30~100, 접기
await window.api.today.getState()
await window.api.today.setCollapsed({ collapsed: true })

off() // 구독 해제
```

---

## 먹이 주기 (Mock 추출)

11단계 전까지는 규칙으로 동작하는 `MockExtractor`(`src/main/extraction/mockExtractor.ts`)가 추출합니다. 개발·배포 빌드 모두 같습니다.

- 빈 줄로 나눈 문단 하나 = 블록 하나. 첫 줄은 할 일, 나머지 줄은 상세.
- `YYYY-MM-DD` 또는 `YYYY-MM-DD HH:mm`이 있으면 마감일.
- 개발 모드에서는 "정리하는 중…"이 보이도록 1.5초 뒤에 응답합니다.

| 표시         | 동작                                        |
| ------------ | ------------------------------------------- |
| `[할일없음]` | 블록 없이 완료 (`blockIds: []`)             |
| `[실패]`     | 재시도할 수 없는 실패                       |
| `[네트워크]` | 2·10·30초 간격 자동 재시도 3번 후 실패      |
| `[애매]`     | 날짜에 "확인 필요"                          |
| 없는 날짜    | 예: `2026-02-30`. 날짜를 비우고 "확인 필요" |

```js
// 성공은 blocks:changed → capture:completed 순서, 실패는 capture:failed
const offDone = window.api.on('capture:completed', (e) => console.log('completed', e))
const offFail = window.api.on('capture:failed', (e) => console.log('failed', e))

// 바로 pending으로 응답하고, 1.5초 뒤 completed { toCalendar: 1, needsInput: 1 }
await window.api.capture.submit({
  text: '견적서 송부 2026-10-20 11:00\n단가표 첨부\n\n회의실 예약',
  method: 'paste'
})

// 실패해 보기
const { data: bad } = await window.api.capture.submit({ text: '[실패] 견적서', method: 'paste' })
await window.api.capture.listFailed() // canRetry: true (원문이 메모리에 있음)
await window.api.capture.retry({ captureId: bad.id }) // 다시 처리됨 ([실패]라 또 실패)
await window.api.capture.dismiss({ captureId: bad.id }) // 실패 카드 닫기

offDone()
offFail()
```

- 처리 중에 종료하면 확인 창이 뜹니다. 그대로 종료하면 다음 실행 때 그 먹이는 `INTERRUPTED` 실패 카드(`canRetry: false`)가 됩니다.
- 원문은 메모리에만 있습니다. DB 어디에도 저장되지 않습니다.

---

## DB 작업

**파일 위치**

| 실행 방식                  | DB                                       | 설정(오늘 창 위치 등)              |
| -------------------------- | ---------------------------------------- | ---------------------------------- |
| 개발 모드 (`npm run dev`)  | 프로젝트의 `data/joopjoop.db` (Git 제외) | `data/settings.json`               |
| 설치된 앱 / `build:unpack` | `%APPDATA%\Joopjoop\joopjoop.db`         | `%APPDATA%\Joopjoop\settings.json` |

- 앱이 시작할 때 DB 생성 → 미적용 마이그레이션 실행 → 시스템 라벨 추가가 자동으로 진행됩니다.
- WAL 모드라 DB 파일 옆에 `-wal`, `-shm` 파일이 함께 생깁니다. 정상입니다.
- 개발 DB를 처음부터 다시 만들려면 앱을 끈 뒤 `data/joopjoop.db*`를 지우고 다시 실행합니다.

**스키마 변경 순서**

1. `src/main/db/schema.ts`를 수정합니다.
2. `npm run db:generate`로 `drizzle/`에 새 마이그레이션 SQL을 만듭니다.
3. 생성된 SQL을 확인합니다. (외래 키, 인덱스, 기본값)
4. `npm run dev`로 실행하면 개발 DB에 자동 적용됩니다.
5. 스키마와 마이그레이션 파일을 **같은 커밋**에 넣습니다.

- 생성된 마이그레이션 파일은 직접 수정하지 않습니다.
- **`develop`·`main`에 병합된 마이그레이션은 지우거나 다시 만들지 않습니다.** 이미 누군가의 DB에 적용됐을 수 있으므로 고칠 내용은 새 마이그레이션으로 추가합니다. 아직 병합 전이고 내 개발 DB에만 적용했다면, 마이그레이션을 지우고 다시 만든 뒤 `data/joopjoop.db*`도 지워서 처음부터 적용합니다.
- `__drizzle_migrations` 테이블은 Drizzle이 적용 이력을 기록하는 곳입니다. 직접 수정하지 않습니다.
- DB가 필요한 테스트는 `createTestDatabase()`(`src/main/db/testDatabase.ts`)로 마이그레이션·시스템 라벨이 적용된 메모리 DB를 엽니다.

**DB 들여다보기 (DBeaver / DB Browser for SQLite)**

- SQLite 연결을 만들고 위 경로의 `joopjoop.db`를 지정합니다.
- **읽기 전용 연결(Read-only connection)** 을 켜 두면 앱을 켠 채로 함께 볼 수 있습니다. 앱이 데이터를 바꾼 뒤에는 F5로 새로고침합니다.
- 값을 직접 고쳐야 할 때만 앱을 끄고 읽기 전용을 해제합니다.

---

## 문제 해결

**`npm run dev` 시 `Error: Electron uninstall`**
Electron 실행 파일이 내려받아지지 않은 상태입니다. npm 11은 허용 목록(`package.json`의 `allowScripts`)에 없는 패키지의 설치 스크립트를 실행하지 않습니다. 아래로 실행 파일을 직접 내려받습니다.

```bash
node node_modules/electron/install.js
```

**Electron·esbuild 버전을 올린 뒤 설치 스크립트 경고가 나올 때**
`allowScripts`는 버전 단위로 기록됩니다. 새 버전을 다시 허용합니다.

```bash
npm approve-scripts --allow-scripts-pending
```

**`NODE_MODULE_VERSION` 불일치 에러 (better-sqlite3)**
네이티브 모듈이 현재 Electron 버전용으로 빌드되지 않은 상태입니다. Electron 버전을 바꿨거나 `npm rebuild`를 실행한 뒤에 생길 수 있습니다.

```bash
npx electron-builder install-app-deps
```

**앱 시작 시 "데이터베이스를 준비하지 못했습니다" 창**
DB 열기나 마이그레이션이 실패한 경우입니다. 창의 메시지와 터미널의 `[db] init failed` 로그로 원인을 확인합니다.

**오늘 창이 화면 밖에 있거나 이상한 크기로 뜰 때**
앱을 끄고 `data/settings.json`을 지우면 기본 위치(주 모니터 오른쪽 위)·기본 크기로 돌아갑니다.
