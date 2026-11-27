# 개발 가이드

README의 [빠른 시작](../README.md#빠른-시작)을 마친 뒤 보는 문서입니다. 규칙과 명세는 [`design.md`](design.md)가 기준입니다.

- [개발 도구](#개발-도구)
- [콘솔에서 코어 호출하기](#콘솔에서-코어-호출하기)
- [먹이 주기 (Mock 추출)](#먹이-주기-mock-추출)
- [실제 추출 (서버)](#실제-추출-서버)
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

`.env`에 서버 주소가 없으면 진짜 AI 대신 **정해진 규칙으로 글을 나누는 가짜 추출기**(`MockExtractor`, `src/main/extraction/mockExtractor.ts`)가 동작합니다. 개발·배포 빌드 모두 같습니다. 그래서 아래 규칙대로 글을 쓰면 원하는 상황을 바로 만들어 볼 수 있습니다. 실제 AI로 추출하려면 [실제 추출 (서버)](#실제-추출-서버)를 봅니다.

### 규칙

- **빈 줄로 나눈 덩어리 하나 = 블록 하나.**
- 덩어리의 **첫 줄 = 할 일**, 나머지 줄 = 상세.
- `2026-10-20` 또는 `2026-10-20 11:00` 형식의 날짜가 있으면 **마감일**이 됩니다(덩어리에서 첫 번째 날짜만). 날짜 글자는 할 일에서 빠집니다.
- 요청자·시작일은 만들지 않습니다. 필요하면 카드의 "+ 추가"로 넣습니다.
- 개발 모드에서는 "정리하는 중…"이 보이도록 1.5초 뒤에 결과가 나옵니다.

### 따라 해 보기

`npm run dev`로 켠 뒤, 아래 글을 **스튜디오 맨 위 먹이 칸**에 붙여넣고 "먹이 주기"를 누릅니다. 오늘 창의 **서랍**에 끌어다 놓거나, 서랍을 누르고 Ctrl+V 해도 같습니다.

> 예시의 날짜는 지금 보고 있는 달의 날짜로 바꿔 넣으세요. 오늘 날짜로 넣으면 오늘 창에도 나옵니다.

**1. 바로 캘린더에 들어가는 일** (할 일 + 날짜)

```
견적서 송부 2026-10-20 11:00
단가표 첨부
```

- 알림·서랍: "캘린더에 1개 넣었어요"
- 캘린더 10월 20일에 `11:00 견적서 송부`(마감 표시)가 생깁니다. 누르면 할 일 `견적서 송부`, 상세 `단가표 첨부`, 마감일 `10/20(화) 11:00`인 카드가 열립니다.

**2. 채워 주세요로 가는 일** (날짜 없음)

```
회의실 예약
10명, 프로젝터 필요
```

- 알림·서랍: "1개는 채워 주세요"
- 오른쪽 "채워 주세요"에 `▸ 회의실 예약 [날짜 없음]`이 생깁니다. 눌러서 "+ 추가 → 마감일"로 날짜를 넣으면 목록에서 빠지고 캘린더로 갑니다. "이대로 두기"를 누르면 "날짜 없는 일"로 갑니다.

**3. 한 번에 여러 개** (빈 줄로 나눔)

```
견적서 송부 2026-10-20

회의실 예약

샘플 발송 2026-10-22
```

- 알림·서랍: "캘린더에 2개 넣었어요. 1개는 채워 주세요."
- 캘린더에 2개, 채워 주세요에 `회의실 예약` 1개가 생깁니다.

**4. 할 일 없이 날짜만 있는 일**

```
2026-10-21
```

- 알림·서랍: "1개는 채워 주세요"
- 캘린더 10월 21일에 `(할 일 없음)`이 생기고, 채워 주세요에도 `▸ (할 일 없음) [할 일 없음]`이 생깁니다. "+ 추가 → 할 일"로 채우면 목록에서 빠집니다.

**5. 날짜가 애매한 일** — 글 어디든 `[애매]`를 넣습니다

```
[애매] 납품 일정 확인 2026-10-23
```

- 캘린더 10월 23일에 **점선 테두리**로 나오고, 채워 주세요에 `▸ 납품 일정 확인 [날짜 확인]`이 생깁니다.
- 카드에서 날짜 옆 **확인**을 누르거나 날짜를 고치면 목록에서 빠집니다(캘린더에는 그대로 남음).

**6. 달력에 없는 날짜**

```
세금계산서 발행 2026-02-30
```

- 2월 30일은 없어서 날짜가 비워지고 원래 글자(`2026-02-30`)만 "확인 필요"로 남습니다. 캘린더에는 안 나옵니다.
- 채워 주세요에 `▸ 세금계산서 발행 [날짜 없음]`이 생깁니다.

**7. 할 일이 아닌 글** — 글 어디든 `[할일없음]`을 넣습니다

```
[할일없음] 점심 뭐 먹을까요?
```

- 알림·서랍: "할 일이 안 보여요". 아무 블록도 생기지 않습니다.

**8. 추출 실패** — 글 어디든 `[실패]`를 넣습니다

```
[실패] 견적서 송부
```

- 서랍: "못 넣었어요. 스튜디오에서 다시 시도해 주세요"
- 스튜디오 먹이 칸 아래에 **실패 카드**가 생깁니다. "다시 시도"를 누르면 다시 처리하고(`[실패]`라 또 실패), "닫기"를 누르면 사라집니다.

**9. 네트워크 실패 (자동 재시도)** — 글 어디든 `[네트워크]`를 넣습니다

```
[네트워크] 견적서 송부
```

- 서랍에 "정리하는 중…"이 약 45초 동안(2·10·30초 간격으로 3번 다시 시도, 시도마다 1.5초) 떠 있다가 실패 카드가 생깁니다.
- 기다리는 동안 앱을 종료하면 "처리 중인 먹이가 1개 있어요" 확인 창이 뜹니다. 그대로 종료하면 다음 실행 때 "처리하지 못했어요. 다시 먹여 주세요" 실패 카드가 됩니다(원문은 메모리에만 있어서 다시 시도할 수 없음).

**10. 글이 아닌 것**

- 바탕화면의 파일을 서랍에 끌어다 놓으면 "글자만 넣을 수 있어요"가 뜨고 아무것도 생기지 않습니다.

### 콘솔로 해 보기

같은 일을 개발자 도구 콘솔에서 할 수도 있습니다. 이벤트가 어떤 순서로 오는지 볼 때 씁니다.

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

## 실제 추출 (서버)

앱은 AI를 직접 부르지 않습니다. 우리 서버의 `POST /api/extract`에 글을 보내고, 서버가 AI를 부른 결과를 받습니다(`ServerExtractor`, 설계 8.9). AI 키는 서버에만 있습니다.

**설정**

1. 프로젝트 폴더에서 `.env.example`을 복사해 `.env`를 만듭니다. `.env`는 Git에 올라가지 않습니다.

   ```bash
   cp .env.example .env
   ```

2. `.env`에 서버 주소와 키를 넣습니다. 둘 다 서버 담당에게 받습니다. 주소 뒤에 `/api/extract`는 붙이지 않습니다(앱이 붙입니다).

   ```
   MAIN_VITE_EXTRACT_URL=http://서버주소:포트
   MAIN_VITE_EXTRACT_KEY=서버 담당에게 받은 키
   ```

3. 앱을 껐다가 `npm run dev`로 다시 켭니다. `.env`는 켤 때 읽으므로, 바꾼 뒤에는 항상 다시 켭니다.
4. 터미널에 `[extraction] 추출기 ServerExtractor`가 찍히면 서버를 씁니다. `MockExtractor`가 찍히면 주소가 비어 있는 것입니다.

Mock으로 돌아가려면 `.env`의 `MAIN_VITE_EXTRACT_URL` 값을 비우고 다시 켭니다.

**실패했을 때**

- 자동 재시도(2·10·30초 뒤)는 AI 한도를 쓰지 않은 실패만 합니다: 서버에 닿지 않음, 30초 안에 응답 없음, `503`.
- 그 밖의 실패(`400`, `401`, `429`, `502`, `504` 등)는 바로 실패 카드가 뜹니다. 카드의 "다시 시도"로 직접 다시 보냅니다. 다시 보낼 때마다 AI 한도를 씁니다.
- 원인은 터미널 로그로 봅니다. 예: `서버 응답 401`(키가 틀림), `서버에 연결하지 못함: 시간 초과`.

**주의**

- 데모 서버는 HTTP라 오가는 글이 암호화되지 않습니다. **시험용 메시지만** 넣습니다.
- `.env`의 값은 빌드할 때 앱 안에 들어갑니다. `.env`가 있는 상태로 만든 설치 파일은 **팀 밖으로 보내지 않습니다.** GitHub Actions의 맥 체험 빌드는 `.env`가 없어 Mock으로 만들어집니다.

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

**`npm ci` 시 `EBADENGINE` / `Unsupported engine`**
Node나 npm 버전이 낮습니다(`.npmrc`의 `engine-strict`로 설치를 멈춤). `node -v`가 24 이상, `npm -v`가 11 이상인지 확인하고 맞춘 뒤 터미널을 새로 열어 다시 설치합니다.

**`npm ci` 시 `package.json and package-lock.json ... are not in sync`**
누군가 `package.json`만 바꾸고 `package-lock.json`을 함께 커밋하지 않은 상태입니다. 바꾼 사람이 `npm install`로 lock 파일을 갱신해 함께 커밋합니다.

**`npm ci` 시 `husky - .git can't be found`**
zip으로 받은 폴더입니다. [README 2단계](../README.md#2-받기)대로 `git clone`으로 다시 받습니다.

**`npm ci` 시 `gyp ERR!` / `MSBuild` 에러 (better-sqlite3)**
미리 빌드된 파일을 받지 못해 직접 빌드하다 실패한 경우입니다. [네이티브 빌드 도구](../README.md#필요할-때만-네이티브-빌드-도구)를 설치하고 터미널을 새로 연 뒤 `npm ci`를 다시 실행합니다.

**`npm run dev` 시 `Error: Electron uninstall`**
Electron 실행 파일이 내려받아지지 않은 상태입니다. npm 11은 허용 목록(`package.json`의 `allowScripts`)에 없는 패키지의 설치 스크립트를 실행하지 않습니다. 아래로 실행 파일을 직접 내려받습니다.

```bash
node node_modules/electron/install.js
```

**Electron·esbuild 버전을 올린 뒤 설치 스크립트 경고가 나올 때**
`allowScripts`는 버전 단위로 기록됩니다. 새 버전을 다시 허용하고, 바뀐 `package.json`을 lock 파일과 함께 커밋합니다. Electron은 `package.json`에 정확한 버전(`44.5.1`)으로 적어 두었으므로, 올릴 때는 그 값과 `allowScripts`를 같이 바꿉니다.

```bash
npm approve-scripts --allow-scripts-pending
```

**`NODE_MODULE_VERSION` 불일치 에러 (better-sqlite3)**
네이티브 모듈이 현재 Electron 버전용으로 빌드되지 않은 상태입니다. Electron 버전을 바꿨거나 `npm rebuild`를 실행한 뒤에 생길 수 있습니다.

```bash
npx electron-builder install-app-deps
```

**글을 넣으면 실패 카드만 뜸 (서버 추출)**
터미널의 `[extraction]` 로그를 봅니다. `서버 응답 401`이면 `.env`의 키가 서버와 다릅니다. `서버에 연결하지 못함`이면 주소나 포트가 틀렸거나 서버가 꺼져 있습니다. `.env`를 고친 뒤에는 앱을 다시 켭니다. [실제 추출 (서버)](#실제-추출-서버)

**앱 시작 시 "데이터베이스를 준비하지 못했습니다" 창**
DB 열기나 마이그레이션이 실패한 경우입니다. 창의 메시지와 터미널의 `[db] init failed` 로그로 원인을 확인합니다.

**오늘 창이 화면 밖에 있거나 이상한 크기로 뜰 때**
앱을 끄고 `data/settings.json`을 지우면 기본 위치(주 모니터 오른쪽 위)·기본 크기로 돌아갑니다.
