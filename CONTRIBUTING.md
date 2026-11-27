# 협업 규칙

## 브랜치

| 브랜치                    | 용도                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `develop`                 | **개발 기준 브랜치.** 모든 작업 브랜치는 여기서 만들고 여기로 병합합니다. |
| `main`                    | 쓰지 않습니다. 배포는 `develop`의 커밋에 버전 태그를 찍어서 합니다.       |
| `유형/#이슈번호-작업내용` | 작업 브랜치. 예: `feat/#22-today-window`, `fix/#30-drop-on-header`        |

```bash
git checkout develop
git pull
git checkout -b feat/#번호-작업내용
```

## 작업 흐름

1. **이슈를 만듭니다.** 템플릿(`.github/ISSUE_TEMPLATE`)을 고릅니다: 기능(`feature_request`), 버그(`bug_report`), 리팩토링(`refactor-template`).
   - 기능 이슈 제목은 `[Feat] 주제: 핵심1, 핵심2` 형식입니다.
   - 본문의 To-do는 커밋 단위로 쪼개 적고, ETC에 정한 사항과 완료 기준을 적습니다.
2. **이슈 번호로 브랜치를 만듭니다.**
3. **설계가 바뀌는 작업이면 첫 커밋으로 `docs/design.md`를 고칩니다.** 코드는 그다음에 맞춥니다.
4. **작은 단위로 커밋합니다.** 한 커밋에 To-do 하나 정도. 커밋마다 테스트가 통과하는 상태를 유지합니다.
5. **PR을 올리기 전에 확인합니다.**
   ```bash
   npm run test
   ```
   ```bash
   npm run typecheck
   ```
   ```bash
   npm run lint
   ```
   ```bash
   git status
   ```
6. **`develop`으로 PR을 올립니다.** PR 템플릿을 채우고 `close #이슈번호`를 적습니다. 화면이 바뀌었으면 스크린샷을 붙입니다.
7. 리뷰 후 `develop`에 병합합니다.

- 커밋할 때 husky가 바뀐 파일에 ESLint·Prettier를 실행합니다. 검사를 건너뛰지 않습니다(`--no-verify` 금지).
- 마이그레이션이 들어간 PR은 스키마와 SQL이 같은 커밋에 있는지 확인합니다([DB 작업](docs/development.md#db-작업)).
- 패키지를 추가·변경한 PR은 `package.json`과 `package-lock.json`이 함께 바뀌었는지 확인합니다. 다른 사람은 받은 뒤 `npm ci`로 다시 설치합니다.

## 배포하는 법

버전 태그(`v0.1.0` 등)를 push하면 [`release.yml`](.github/workflows/release.yml)이 Windows·맥 설치 파일을 만들어 **Release 초안(draft)**에 올립니다. 자동으로 공개하지 않습니다.

### 처음 한 번: Secrets 등록

저장소 **Settings → Secrets and variables → Actions**에 추출 서버 값을 넣습니다. 비어 있으면 Mock으로 도는 앱이 나가지 않도록 워크플로가 멈춥니다.

| 이름                    | 값                                |
| ----------------------- | --------------------------------- |
| `MAIN_VITE_EXTRACT_URL` | 추출 서버 주소 (HTTPS)            |
| `MAIN_VITE_EXTRACT_KEY` | 추출 서버 키 (서버 담당에게 받음) |

키는 빌드할 때 앱 안에 들어가서 꺼낼 수 있습니다. 서버에서 사용량 제한으로 막습니다.

### 배포 순서

1. 배포할 작업을 `develop`에 모두 병합합니다.
2. `package.json`의 `version`을 올리는 PR을 `develop`에 병합합니다(예: `0.1.0` → `0.2.0`). 태그와 버전이 다르면 워크플로가 멈춥니다.
3. `develop`의 최신 커밋에서 태그를 만들어 push합니다.

   ```bash
   git checkout develop
   git pull
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. [Actions](https://github.com/Joopjoop-desktop/moanyang-desktop/actions/workflows/release.yml)에서 Release 워크플로가 끝나기를 기다립니다(약 15~20분).
   - 버전 확인 → Windows·맥 빌드와 앱 검사 → 둘 다 성공하면 Release 초안 생성
5. [Releases](https://github.com/Joopjoop-desktop/moanyang-desktop/releases)의 초안에서 파일 4개를 확인합니다.
   - 버전이 붙은 설치 파일 2개 (`…-0.2.0-setup.exe`, `…-0.2.0-arm64.dmg`)
   - 랜딩페이지 다운로드 버튼용 고정 이름 2개 (`MoaNyang-Setup.exe`, `MoaNyang-arm64.dmg`)
6. Publish 전에 설치해 봅니다(아래 확인 목록).
7. 초안의 설명을 다듬고 **Publish release**를 누릅니다. 이때부터 랜딩페이지 버튼이 새 버전을 받습니다.

### Publish 전 확인

- [ ] Windows PC에서 설치 → 실행 → 붙여넣은 글이 실제 추출로 카드가 되는지
- [ ] Apple Silicon 맥에서 dmg 설치 → 실행 → 같은 확인
- [ ] 앱을 껐다 켜도 데이터가 남는지
- [ ] 앱 삭제가 되는지
- [ ] 서버에 사용량 제한이 걸려 있는지 (처음 배포 때)

### 실패했을 때

- **태그와 버전이 다름:** 태그를 지우고(`git push origin :refs/tags/v0.2.0`, `git tag -d v0.2.0`) 버전을 맞춘 뒤 다시 태그를 push합니다.
- **빌드나 검사 실패:** 원인을 고쳐 병합한 뒤, 같은 버전이면 태그를 지우고 고친 커밋에 다시 만듭니다. 코드는 그대로이고 일시적인 실패였다면 Actions의 **Re-run failed jobs**를 누르거나, Release 워크플로의 **Run workflow**에 태그를 넣어 다시 돌립니다.
- **다시 돌려도 안전합니다:** 같은 태그의 초안이 있으면 파일만 바꿉니다. 이미 Publish된 버전은 덮어쓰지 않고 멈추므로, 그때는 버전을 올려 새로 배포합니다.

## 커밋 메시지

`유형: 내용` 형식으로, 무엇을 했는지 한국어로 짧게 적습니다. 예: `feat: 오늘 창 서랍(끌어다 놓기·붙여넣기)`

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

## 리뷰할 때 보는 것

- 층 분리: 화면이 `window.api` 말고 다른 길로 코어에 닿지 않는지, 도메인이 DB·Electron에 의존하지 않는지
- 데이터 변경이 서비스의 한 트랜잭션 안에서 History와 함께 일어나는지
- 메시지 원문이 DB·로그에 남지 않는지
- 새 규칙·채널이 `docs/design.md`에 반영됐는지, 테스트가 함께 들어왔는지
