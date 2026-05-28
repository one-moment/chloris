# Mattermost Project Communication MVP

Mattermost 스타일의 사내 프로젝트 커뮤니케이션 MVP입니다. 현재 버전은 Next.js 기반 React 앱으로 전환되었습니다. 기존 정적 목업 파일도 참고용으로 남겨두었습니다.

## 주요 기능

- 프로젝트 선택 및 생성
- 프로젝트별 채널 생성
- 채널별 Messages, Ideas, Files 데이터 분리
- 채널 유형: 일반 소통, 구매요청, 입고, 출고, 재고관리
- 프로젝트 채널형 사이드바
- Messages: 채널 메시지와 자동화봇 명령어 실행
- Ideas: 게시글 작성, 댓글, 멘션, 상태 변경, 상태 필터
- Files: 게시글/댓글/봇 실행 결과 파일 목록 및 파일 메타데이터 추가
- 자동화봇 등록: Codex, Claude Code, Custom Webhook
- 자동화봇 실행 결과를 Messages와 Files에 기록
- 자동화봇 실행 상태와 실행 로그 관리
- Webhook payload 미리보기
- 맥미니 구매봇 연동을 위한 구매 준비/승인 대기 흐름
- 구매봇은 결제 직전 단계까지만 준비하고 최종 결제는 담당자가 승인
- 입고/출고/재고관리 채널은 스프레드시트 자동화 payload 생성
- 브라우저 `localStorage` 기반 데이터 저장

## 실행 방법

Next.js 개발 서버를 실행합니다.

```bash
npm install
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:3000
```

정적 목업을 확인하려면 로컬 정적 서버를 사용할 수 있습니다.

```bash
python3 -m http.server 4173
```

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:4173
```

## 파일 구조

```text
index.html    화면 구조
styles.css    UI 스타일
app.js        상태 관리와 상호작용 로직
app/          Next.js App Router 소스
package.json  Next.js 실행 스크립트와 의존성
PLAN.md       개발계획
```

## 다음 단계

현재는 프론트엔드 MVP입니다. 실제 사내 서비스로 확장하려면 Mattermost API, 인증, 백엔드 저장소, 파일 저장소, 자동화봇 실행 서버를 연결해야 합니다.

## GitHub

원격 저장소는 다음 주소를 사용합니다.

```text
https://github.com/one-moment/mattermost.git
```

맥북에서 빠르게 업로드하려면 `push-to-github.sh` 또는 `GITHUB_UPLOAD.md`를 참고하세요.
