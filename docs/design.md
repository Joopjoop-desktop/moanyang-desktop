# 줍줍(Joopjoop) 설계 문서 — MVP

> 흩어진 메시지에서 할 일을 드래그·붙여넣기로 "줍줍"해 블록으로 정리하고 일정으로 만드는 Windows 데스크톱 앱

---

## 1. 개요

### 1.1 서비스 요약
- 사용자가 카톡, 메일 등 어떤 앱에서든 텍스트를 **드래그 또는 복사 후 붙여넣기**로 앱에 넣는다(먹이 주기).
- AI가 텍스트에서 할 일, 시작일, 마감일, 요청자를 뽑아 **블록**으로 만든다.
- 사용자는 블록 안의 **요소**를 끌어서 옮기며 흩어진 정보를 하나의 일로 합치거나 나눈다.
- 블록은 일정(캘린더)으로 배치된다.

### 1.2 타깃
여러 거래처·여러 창구로 날짜가 걸린 요청을 주고받는 B2B 실무자 (1차: 수주형 제조업 내근 영업관리)

### 1.3 MVP 목적
영상 촬영 및 랜딩페이지 검증용. 단, 반응이 좋으면 그대로 실제 제품으로 확장할 수 있도록 **확장성과 유지보수를 고려한 구조**로 설계한다.

### 1.4 핵심 원칙
- **블록 내용은 사용자가 직접 입력하지 않는다.** (먹이 → AI 추출) 단, 요소 편집·라벨·상태는 사용자가 직접 한다.
- **자동 규칙을 최소화한다.** 상태·라벨은 사용자가 바꿀 때만 바뀐다. 요소·블록 간 우선순위는 두지 않는다.
- **메시지 원문은 저장하지 않는다.** 블록(요소)만 남긴다.

---

## 2. 전체 아키텍처

### 2.1 구조: 서버 최소형
- 데스크톱 앱이 대부분을 처리하고, 데이터는 **사용자 PC(로컬 DB)에만 저장**한다.
- 서버는 AI 추출 중계, 인증, 사용량 관리 등 최소 역할만 한다.
- 기기 간 동기화는 추후 **사용자가 켰을 때만 동작하는 선택형 동기화**로 추가한다.
- **MVP에서는 서버를 개발하지 않는다.** AI 추출은 목업 또는 개발용 API 직접 호출로 대체한다.

### 2.2 층별 책임

| 층 | 담당 |
|---|---|
| **UI 층** (Electron renderer) | 캐릭터 오버레이, 먹이 입력(드래그 드롭·붙여넣기), 스튜디오(검토함·블록 보드), 요소 드래그, 일정 화면, 알림 표시, 설정 화면 |
| **코어 층** (Electron main) | OS 연동, 로컬 DB, 블록·요소 도메인 로직, 추출 요청·큐, 스케줄링, 캘린더 연동, 알림 스케줄러, 서버 통신, IPC 핸들러 |
| **서버** (MVP 이후) | AI 중계(API 키 보호, 프롬프트 관리, 응답 검증, 원문 미저장), 인증, 사용량 제한, 업데이트 배포, 결제·라이선스, 선택형 동기화 |

### 2.3 통신 흐름

```
UI ──(IPC 요청)──▶ 코어 ──(HTTPS)──▶ 서버 ──▶ LLM
UI ◀─(IPC 이벤트)── 코어 ◀──────────── 서버
```

- UI는 서버를 직접 호출하지 않는다. 모든 서버 통신은 코어에서만 한다.
- 서버 → 앱 푸시가 필요해지면 그때 WebSocket/SSE를 추가한다.

---

## 3. 기술 스택

| 영역 | 선택 |
|---|---|
| 앱 프레임워크 | Electron |
| 언어 | TypeScript |
| UI | React |
| 프로젝트 뼈대 | **electron-vite** (확정) |
| 로컬 DB | SQLite (**better-sqlite3**) |
| ORM | **Drizzle ORM** + drizzle-kit (TypeORM에서 변경) |
| 테스트 | Vitest(단위), Playwright(E2E) |
| 코드 품질 | ESLint, Prettier, husky + lint-staged |
| 빌드·배포 | electron-builder, electron-updater, GitHub Actions |
| 에러 수집 (이후) | Sentry (Electron SDK) |
| 제품 분석 (이후) | PostHog / Amplitude / Mixpanel 중 선택 (GA는 랜딩페이지용) |
| 서버 관측 (이후) | Datadog |
| 대상 OS | Windows 우선 |

**확정 구성: electron-vite + better-sqlite3 + Drizzle ORM + electron-builder**

TypeORM → Drizzle 변경 이유: vite(esbuild)는 TypeORM이 의존하는 데코레이터 메타데이터(`emitDecoratorMetadata`)를 생성하지 못하고, 엔티티·마이그레이션 경로 glob도 번들링과 맞지 않음.

### 3.1 빌드 구성
- electron-vite에서 코어(main) 층은 외부 의존성을 번들에 포함하지 않고 `node_modules`에서 불러오도록 설정한다.
- better-sqlite3는 electron-builder의 설치 후 리빌드(`install-app-deps`)를 `postinstall`에 걸어 Electron 버전에 맞게 자동 리빌드한다.
- 마이그레이션은 drizzle-kit으로 SQL 파일을 생성하고 앱 패키지에 포함되도록 패키징 설정을 한다. 앱 시작 시 미적용 마이그레이션을 순서대로 실행한다.
- 마이그레이션 폴더 경로는 개발 모드와 패키징된 앱에서 다르므로 시작 시 환경에 따라 결정한다.

---

## 4. 저장소 구조

하나의 저장소에서 폴더로 층을 나눈다.

```
joopjoop-desktop/
├─ src/
│  ├─ main/       # 코어 층
│  │  ├─ ipc/          # IPC 핸들러 (Controller 역할)
│  │  ├─ services/     # 도메인 서비스
│  │  ├─ domain/       # 순수 도메인 로직 (Electron 비의존)
│  │  ├─ repositories/ # 저장소 인터페이스·구현 (소프트 딜리트 필터 담당)
│  │  ├─ db/           # Drizzle 스키마, DB 연결, 마이그레이션 실행
│  │  ├─ adapters/     # Extractor, CalendarProvider 등 외부 연동
│  │  ├─ os/           # 창·트레이·클립보드·단축키
│  │  └─ infra/        # Logger, ErrorReporter, Analytics, 설정
│  ├─ preload/    # UI에 허용된 기능만 노출
│  ├─ renderer/   # UI 층
│  └─ shared/     # IPC 요청·응답 타입, 에러 코드, 공통 타입
├─ drizzle/       # drizzle-kit이 생성한 마이그레이션 SQL (패키지에 포함)
└─ package.json
```

서버는 추후 별도 저장소 또는 모노레포(`apps/desktop`, `apps/server`, `packages/shared`)로 추가한다.

---

## 5. 코어 층 설계

### 5.1 내부 계층

| 계층 | Spring 비유 | 역할 |
|---|---|---|
| IPC | Controller | UI 요청 수신, 입력 검증, 공통 응답 형식으로 반환 |
| Service | Service | 비즈니스 로직, 트랜잭션, 이력 기록 |
| Domain | Domain | 요소 이동·충돌 판단 등 순수 로직 |
| Repository | Repository | 엔티티 저장·조회, 소프트 딜리트 필터 |
| Adapter | 외부 API Client | AI 추출, 캘린더 등 |
| OS | — | 창, 트레이, 클립보드, 단축키 |

### 5.2 설계 원칙
- **인터페이스 + 의존성 주입**: 목업 ↔ 실제 구현을 서비스 코드 변경 없이 교체한다.
  - `Extractor`: `MockExtractor` → `DirectLlmExtractor`(개발용) → `ServerExtractor`
  - `CalendarProvider`: `MockCalendarProvider` → Google / Outlook
  - `Logger`, `ErrorReporter`, `Analytics`
- **도메인 로직은 Electron에 의존하지 않는다.** 단독 테스트 가능, 추후 서버로 이전 가능.
- **모든 변경은 서비스 계층을 거친다.** 변경과 이력 기록을 같은 트랜잭션에서 처리한다.
- **트랜잭션은 동기다.** better-sqlite3 + Drizzle 트랜잭션 안에서는 `await`를 쓸 수 없으므로, 트랜잭션 안에는 DB 작업만 둔다. AI 추출 등 비동기 작업은 트랜잭션 밖에서 끝내고 결과 저장만 트랜잭션으로 한다.

### 5.3 모듈별 MVP 범위

| 모듈 | MVP | 이후 |
|---|---|---|
| OS 연동 | 캐릭터 오버레이 창(투명·항상 위), 스튜디오 창, 트레이 | 전역 단축키, 화면 공유 감지, 자동 실행, 직전 활성 앱 감지 |
| 먹이 수집 | 드래그 드롭, 캐릭터 클릭 후 붙여넣기 | OCR 영역 캡처, 공식 툴 연동 |
| 추출 | 목업 또는 API 직접 호출 | 서버 중계 |
| 블록·요소 | 생성, 편집, 이동, 합치기, 삭제·복구 | — |
| 저장소 | SQLite + 마이그레이션 | 로컬 암호화, 선택형 동기화 |
| 스케줄링 | 날짜 표시, 목업 배치 | 소요 시간 추정, 빈 시간 배치, 재조정 |
| 캘린더 | 목업 캘린더 | Google / Outlook 연동 |
| 알림 | — | 마감 임박, 회신 대기, 아침 브리핑 |

---

## 6. 데이터 모델

### 6.1 개념
- **블록**은 **요소를 담는 그릇**이다.
- **요소**는 블록 안의 정보 한 조각이다. (할 일, 시작일, 마감일, 요청자, 메모 등)
- 모든 요소는 비어 있을 수 있다. 날짜 없는 할 일, 할 일 없는 날짜 블록 모두 가능.
- **합치기** = 한 블록의 요소들을 다른 블록으로 옮기기
- **분리** = 요소를 끌어내 다른 블록으로 옮기거나 빈 곳에 놓아 새 블록 만들기

### 6.2 엔티티

#### Capture — 먹이를 준 행위
| 필드 | 설명 |
|---|---|
| id | UUID v7 |
| method | `drag` / `paste` (이후 `ocr`, `integration` 등 추가) |
| sourceApp | 직전 활성 앱 이름 (예: `KakaoTalk.exe`), null 허용. 창 제목은 저장하지 않음 |
| status | `pending` / `extracting` / `done` / `failed` |
| errorCode | 실패 시 코드, null 허용 (예: `CAPTURE_EXTRACT_FAILED`, `INTERRUPTED`) |
| capturedAt | 먹인 시각 |

- **원문 텍스트는 저장하지 않는다.**

#### Block — 요소를 담는 그릇
| 필드 | 설명 |
|---|---|
| id | UUID v7 |
| reviewedAt | 검토 완료 시각, null이면 검토함 |
| completedAt | 완료 시각, null이면 미완료 |
| deletedAt | 소프트 딜리트 시각 |
| deleteReason | `user` / `emptied`, 삭제되지 않았으면 null |
| createdAt / updatedAt | |

#### Element — 블록 안의 정보 한 조각
| 필드 | 설명 |
|---|---|
| id | UUID v7 |
| blockId | 속한 블록 (이동 시 변경) |
| type | `task` / `detail` / `start_date` / `due_date` / `requester` / `memo` (확장 가능) |
| value | 텍스트 요소(할 일·상세·요청자·메모)의 값 |
| dateValue | 날짜 요소의 날짜 `YYYY-MM-DD` (인덱스) |
| timeValue | 시간 언급 시에만 `HH:mm` |
| rawText | 날짜 원래 표현 ("다음주 금요일까지"), 상세 표시용 |
| needsConfirm | AI 해석이 애매했는지. 화면에 "확인 필요" 표시, 사용자가 수정하거나 확인하면 꺼짐 |
| captureId | 출처 먹이, 사용자가 직접 만든 요소(메모 등)는 null |
| orderIndex | 블록 안에서의 순서 |
| deletedAt | 소프트 딜리트 시각 |
| deleteReason | `user`(사용자가 직접 삭제) / `discarded`(충돌에서 버려짐), 삭제되지 않았으면 null |
| createdAt / updatedAt | |

- 날짜를 JSON이 아닌 전용 컬럼으로 두는 이유: 캘린더에서 날짜로 조회·정렬하므로 인덱스가 필요하다.
- AI가 처음 뽑은 값은 History에 남으므로 별도 컬럼을 두지 않는다.

#### Label — 상태 라벨
| 필드 | 설명 |
|---|---|
| id | UUID v7 |
| name | 예: 조율 중, 회신 대기 |
| isSystem | 시스템 제공 여부 (시스템 라벨은 기능과 연결) |
| groupKey | 같은 그룹 안에서는 하나만 붙음 |

#### BlockLabel — 블록–라벨 N:M
| 필드 | 설명 |
|---|---|
| blockId | |
| labelId | |
| attachedAt | 붙인 시각 ("회신 대기 N일째" 계산용) |

#### History — 변경 이력 (추가 전용)
| 필드 | 설명 |
|---|---|
| id | UUID v7 |
| entityType / entityId | 대상 |
| action | 예: `element.created`, `element.updated`, `element.moved`, `element.deleted`, `element.discarded`, `block.deleted`, `block.reviewed`, `block.completed`, `label.attached` |
| before / after | 변경 전후 값 (JSON) |
| occurredAt | |

- 수정·삭제하지 않는다. MVP에서는 기록만 하고 실행 취소·이력 화면은 만들지 않는다.

### 6.3 관계
```
Capture 1 ── N Element
Block   1 ── N Element
Block   N ── M Label   (BlockLabel)
```

### 6.4 공통 규칙
- **ID**: UUID v7 (선택형 동기화 대비, 시간순 정렬 가능)
- **삭제**: 소프트 딜리트 → 일정 기간(예: 30일) 경과 후 앱 시작 시 하드 딜리트. 하드 딜리트 시 관련 요소·라벨 연결·이력도 함께 삭제
- **마이그레이션**: MVP부터 적용. drizzle-kit으로 SQL 생성, 앱 시작 시 실행 (3.1 참고)
- **DB 위치**: 배포는 Electron `userData` 경로, 개발은 프로젝트 내 `data/` (`.gitignore` 처리)

### 6.5 소프트 딜리트 판단
- 요소가 살아 있다 = **요소의 `deletedAt`이 null** 이고 **속한 블록의 `deletedAt`도 null**.
- 이 조건은 **저장소 계층 한 곳**에서 처리한다. 요소를 조회하는 모든 기본 메서드가 자동으로 붙인다.
- 삭제된 데이터까지 봐야 하는 경우(휴지통 화면, 하드 딜리트)만 별도 메서드로 분리한다.
- ORM 기능에 의존하지 않고 저장소 계층에서 직접 처리한다.

---

## 7. 도메인 규칙

### 7.1 요소 이동 (합치기·분리)
- 요소를 다른 블록에 놓으면 그 블록으로 이동한다.
- 블록을 다른 블록에 놓으면 모든 요소가 이동한다(합치기).
- 요소를 빈 곳에 놓으면 그 요소만 담은 새 블록이 생긴다(분리).
- 블록이 합쳐진 뒤 또 다른 블록이 합쳐져도 계층 없이 하나의 블록에 요소가 추가될 뿐이다.

### 7.2 같은 종류 요소 충돌

#### 충돌 대상 여부
요소 종류마다 **"충돌 대상 여부" 속성**을 둔다. 새 종류를 추가할 때는 이 속성만 정한다.

| 묶음 | 종류 | 이동으로 겹치면 |
|---|---|---|
| 충돌 대상 (하나여야 자연스러운 것) | `task`, `start_date`, `due_date`, `requester` | 충돌 선택 |
| 충돌 아님 (여러 개가 자연스러운 것) | `detail`, `memo` | 그냥 뒤에 추가 |

- 날짜 역할: 시작일 + 마감일은 기간이 되며 충돌이 아니다. 마감일 + 마감일, 시작일 + 시작일은 충돌이다.

#### 값이 완전히 같을 때 — 자동 정리
- 겹친 요소의 값이 완전히 같으면 **선택 화면 없이 하나로 자동 정리**한다. 이동해 들어온 요소를 버리고 대상 블록에 있던 요소를 남긴다.
- 정리된 요소는 History에 `element.discarded`로 남긴다.
- 같은 값의 기준은 **엄격하게** 둔다.
  - 텍스트: 앞뒤 공백만 정리한 뒤 완전히 일치할 때만
  - 날짜: `dateValue`와 `timeValue`가 같을 때 (`rawText`는 달라도 같은 값으로 본다)
  - "김과장"과 "김 과장"처럼 비슷하기만 한 값은 같은 값으로 보지 않고 선택 화면으로 보낸다.

#### 값이 다를 때 — 충돌 선택
- **사용자가 남길 요소를 고른다.** 여러 개를 함께 남길 수도 있다.
- **고르지 않은 요소는 버린다.** 요소에 `deletedAt`, `deleteReason = 'discarded'`를 찍고 History에 `element.discarded`로 남긴다. 휴지통에는 보이지 않는다.
- 같은 종류 요소가 여러 개 남으면 **우선순위 없이 모두 동일하게 표시**한다. 마감일이 둘이면 캘린더에도 둘 다 표시한다.

### 7.3 블록 삭제와 빈 블록
- **블록 삭제 시 요소에는 `deletedAt`을 찍지 않는다.** 블록만 삭제 표시하고, 복구하면 연결된 요소가 그대로 돌아온다. (요소에 찍으면 블록 삭제 전에 따로 지운 요소와 구분되지 않아 복구 시 함께 살아난다.)
- 요소 이동으로 블록이 비면 → **자동 소프트 딜리트, `deleteReason = 'emptied'`**. 휴지통에 보이지 않는다. 라벨 연결도 함께 사라진다. 되돌리기는 이후 이력 기반 실행 취소가 맡는다.
- 사용자가 요소를 삭제하면 → 요소에 `deletedAt`, `deleteReason = 'user'`를 찍고 History에 `element.deleted`를 남긴다.
- 단, 사용자가 블록의 **마지막 요소를 삭제**하면 → 요소에 `deletedAt`을 찍지 않고 **블록을 `deleteReason = 'user'`로 삭제**한다. 휴지통에 보이고, 복구하면 그 요소도 함께 돌아온다.
  - History는 `block.deleted` **하나만** 남긴다. 요소는 실제로 삭제 상태가 아니므로 `element.deleted`를 남기지 않는다.
  - `after`: `{ deleteReason: 'user', trigger: 'element.delete', elementId }`
- 휴지통 목록은 `deleteReason = 'user'`만 보여준다.

### 7.4 상태와 라벨
- 상태 = 검토 여부(`reviewedAt`), 완료 여부(`completedAt`), 라벨
- **상태는 사용자가 직접 바꿀 때만 바뀐다.** 요소 이동으로 자동 변경되지 않는다.
- 검토 완료 블록에 새 요소가 합쳐져도 검토 상태는 유지된다. 합치기 자체가 사용자가 요소를 보고 직접 끌어다 놓는 행동이므로 검토를 겸한다.
- 새로 생긴 블록은 기본값(검토 전, 미완료, 라벨 없음)으로 시작한다.
- 라벨은 사용자가 직접 붙이고 뗀다. AI는 라벨을 자동으로 붙이지 않는다.
- 시스템 라벨은 기능과 연결된다. (이후: 회신 대기 → N일 후 알림, 조율 중 → 가일정 표시)
- 사용자 정의 라벨은 구조만 지원하고 화면 기능은 MVP 이후에 연다.

### 7.5 캘린더 표시
| 블록의 날짜 요소 | 표시 |
|---|---|
| 날짜 없음 | 캘린더에 안 나오고 보드에만 |
| 마감일만 | 마감일에 표시 |
| 시작일만 | 시작일에 점으로 표시 |
| 시작일 + 마감일 | 기간 막대 |
| 마감일 여러 개 | 각 날짜에 모두 표시 (우선순위 없음) |

---

## 8. 추출 (AI)

### 8.1 흐름 (비동기)
1. UI → `capture:submit` (원문 텍스트, 방식)
2. 코어: Capture 생성(`pending`), 즉시 응답 → 캐릭터 "먹었어요"
3. 코어: 추출 큐에서 `Extractor` 호출(`extracting`)
4. 성공 → Block·Element 생성, Capture `done` → `capture:completed { captureId, blockIds }` 이벤트
   - `notTask: true`이면 블록 없이 `done`, `blockIds`는 빈 배열 → 캐릭터 "할 일이 안 보여요"
5. 실패 → Capture `failed` → `capture:failed` 이벤트

### 8.2 원문 처리
- 원문은 **메모리에만** 보관하고 추출이 끝나면 즉시 버린다. DB에 저장하지 않는다.
- 네트워크 오류 시 앱이 켜져 있는 동안 간격을 두고 **자동 재시도**한다.
- 처리 중인 먹이가 있을 때 앱을 종료하면 **확인을 받는다.**
- 계속 실패하면 검토함에 **실패 카드**를 띄우고, 원문이 메모리에 있는 동안 "다시 시도"를 제공한다.
- **앱 시작 시** `pending`·`extracting` 상태인 Capture는 `failed`, `errorCode = 'INTERRUPTED'`로 바꾼다. 원문이 없으므로 "다시 시도" 없이 "처리하지 못했어요, 다시 먹여주세요" 실패 카드만 보여준다.

### 8.3 입력 형식
```ts
type ExtractInput = {
  text: string;        // 원문 (메모리에서만 사용)
  capturedAt: string;  // 날짜 계산 기준
  timezone: string;    // 예: "Asia/Seoul"
};
```

### 8.4 출력 형식
```ts
type DateValue = {
  date: string | null;     // "2026-10-09"
  time: string | null;     // 시간 언급 시에만 "11:00"
  rawText: string | null;  // 원래 표현 "다음주 금요일까지"
  ambiguous: boolean;      // 해석이 애매하면 true → Element.needsConfirm
};

type ExtractOutput = {
  schemaVersion: 1;
  notTask: boolean;        // 할 일이 없는 내용이면 true, items는 빈 배열
  items: Array<{
    task: string | null;
    detail: string | null;
    requester: string | null;
    startDate: DateValue | null;
    dueDate: DateValue | null;
  }>;
};
```

- **먹이 하나에서 블록 여러 개**가 나올 수 있다. `items` 하나당 블록 하나.
- 추출은 **애매하면 나누는 방향**으로 한다. 잘게 나눈 실수는 사용자가 합치면 되지만, 묶어버린 실수는 고치기 어렵기 때문이다.
- 날짜는 **시작일과 마감일 역할을 구분**한다. 역할이 애매하면 마감일로 처리한다.
- 같은 먹이에서 나온 블록은 검토함에서 나란히 표시한다.
- 추출 모델은 저렴한 모델로 충분하다(짧은 텍스트에서 정해진 형식 추출).

---

## 9. IPC 명세

### 9.1 규칙
- 이름: `도메인:동작`
- 요청·응답 타입은 `src/shared`에 정의하고 UI와 코어가 공유한다. (Swagger 역할)
- UI는 preload가 노출한 함수로만 코어를 호출한다.

### 9.2 공통 응답 형식
```ts
type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```
- 코어는 예외를 그대로 던지지 않고 이 형식으로 감싸 반환한다.
- 에러 코드는 도메인별로 정의한다. 예: `BLOCK_NOT_FOUND`, `ELEMENT_NOT_FOUND`, `CAPTURE_EXTRACT_FAILED`, `INTERRUPTED`
- 사용자에게 보여줄 문구는 UI가 코드 기준으로 결정한다.
- 정의되지 않은 에러는 `INTERNAL_ERROR`로 반환하고 상세는 로그·에러 수집에만 남긴다.

### 9.3 요청 (UI → 코어)

| 채널 | 설명 |
|---|---|
| `capture:submit` | 먹이 주기 (텍스트, 방식) → 즉시 응답, 추출은 비동기 |
| `capture:retry` | 실패한 먹이 다시 시도 (원문이 메모리에 있을 때) |
| `block:list` | 목록 조회 (검토함 / 전체 / 완료 / 휴지통) |
| `block:get` | 단건 조회 (요소, 라벨 포함) |
| `block:merge` | 블록의 모든 요소를 다른 블록으로 이동. 충돌 시 선택 결과 포함 |
| `block:review` | 검토 완료 / 취소 |
| `block:complete` / `block:reopen` | 완료 / 되돌리기 |
| `block:delete` / `block:restore` | 휴지통 / 복구 |
| `element:create` | 요소 추가 (메모 등 사용자 작성) |
| `element:update` | 요소 값 수정 |
| `element:delete` | 요소 삭제 (마지막 요소면 블록을 `user`로 삭제, 7.3) |
| `element:move` | 다른 블록으로 이동, 순서 변경, 또는 새 블록으로 분리. 충돌 시 선택 결과 포함 |
| `element:checkConflict` | 이동 전 같은 종류 요소 충돌 여부 확인 |
| `label:list` | 라벨 목록 |
| `label:attach` / `label:detach` | 라벨 붙이기 / 떼기 |
| `schedule:propose` / `schedule:confirm` | 일정 배치안 / 확정 (MVP 목업) |
| `calendar:list` | 기간별 일정 조회 (MVP 목업) |
| `settings:get` / `settings:update` | 설정 |
| `window:openStudio` | 스튜디오 창 열기 |

### 9.4 이벤트 (코어 → UI)

| 채널 | 설명 |
|---|---|
| `capture:completed` | 추출 완료 `{ captureId, blockIds }`. 빈 배열이면 할 일 없음 (캐릭터 반응) |
| `capture:failed` | 추출 실패 |
| `blocks:changed` | 데이터 변경, 목록 갱신 필요 |

---

## 10. 서버 통신 (MVP 이후)

- 코어에서만 HTTPS(REST)로 호출한다.
- 인증 토큰은 Electron `safeStorage`로 암호화 보관한다.
- API 클라이언트 모듈 하나에서 타임아웃, 재시도, 인증 헤더, 추적 ID를 처리한다.
- 요청마다 추적 ID를 붙여 서버 로그(Datadog)까지 이어서 추적한다.
- 추출 프롬프트는 서버에서 관리해 앱 업데이트 없이 개선할 수 있게 한다.

---

## 11. 보안·개인정보

- Electron: `contextIsolation` 켜기, `nodeIntegration` 끄기, preload로 허용 기능만 노출
- 메시지 원문 미저장 (메모리에서 추출 후 폐기)
- 창 제목 미저장 (대화방명·거래처명 노출 방지), 앱 이름만 기록
- 분석 이벤트에는 행동만 기록하고 원문·블록 내용은 절대 포함하지 않음
- 클립보드는 사용자가 붙여넣는 순간에만 읽음 (상시 감시하지 않음)
- 개발용 API 키를 넣은 빌드는 팀 내부에서만 사용, 외부 배포 금지 (키는 `.env`, Git 제외)
- (이후) 로컬 DB 암호화

---

## 12. 개발 환경

| 목적 | 방법 |
|---|---|
| 실행 | 개발 모드 실행(핫 리로드) |
| UI 확인 | 앱 창의 Chrome 개발자 도구 |
| 코어 기능 호출 (Postman 대신) | 개발자 도구 콘솔에서 preload 노출 함수 직접 호출 |
| 코어 디버깅 | VS Code 디버거를 메인 프로세스에 연결 |
| DB 확인 | DBeaver 또는 DB Browser for SQLite로 DB 파일 열기 (수정은 앱 종료 후) |
| 로직 검증 | Vitest 단위 테스트 (도메인·서비스) |
| 명세 확인 (Swagger 대신) | `src/shared`의 IPC 타입 정의 |

- better-sqlite3 네이티브 모듈은 `postinstall`에서 Electron 버전에 맞게 리빌드한다 (3.1).

---

## 13. MVP 범위 요약

**포함**
- 캐릭터 오버레이, 드래그 드롭·붙여넣기 먹이 주기
- 목업(또는 개발용 직접 호출) 추출, 비동기 처리
- 블록·요소 생성, 편집, 이동(합치기·분리), 충돌 선택
- 검토·완료 상태, 시스템 라벨 붙이기
- 목업 캘린더 배치
- SQLite + Drizzle + 마이그레이션, History 기록

**제외 (이후)**
- 서버(인증, AI 중계, 사용량, 결제, 동기화)
- 실제 캘린더 연동, 알림, 스케줄링 알고리즘
- OCR, 공식 툴 연동, 전역 단축키, 화면 공유 감지
- 사용자 정의 라벨 화면, 실행 취소·이력 화면
- 로컬 DB 암호화, 에러 수집·제품 분석 도구 연동
- macOS 지원

---

## 14. 확인 필요 항목

- **카톡 등 각 앱의 드래그 지원 여부** 실측 (카톡 PC는 드래그 불가 확인 → 붙여넣기로 대응)

### 결정 완료
- ~~프로젝트 뼈대 도구 선택~~ → electron-vite 확정 (3장)
- ~~메모의 충돌 처리~~ / ~~충돌 대상 요소 종류~~ → 7.2
- ~~마지막 요소 삭제 시 History 기록~~ → 7.3
