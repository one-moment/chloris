# Mattermost Project Communication MVP

Mattermost 스타일의 사내 커뮤니케이션 MVP입니다. 현재 버전은 Next.js App Router 기반으로 동작하며, 핵심 모델을 `프로젝트 > 채널 > Messages / Ideas / Files` 구조로 정리했습니다.

## 주요 기능

- 프로젝트 생성 및 전환
- 이메일/비밀번호 기반 사용자 계정 생성, 로그인, 로그아웃
- 프로젝트 안에서 채널 생성
- 채널별 Messages, Ideas, Files 분리
- Messages와 Ideas에 사진/파일 첨부
- 채널 유형: 일반 소통, 구매요청, 입고, 출고, 재고관리
- Ideas 게시글 작성, 댓글, 멘션, 상태 변경
- Files에 수동 파일 및 자동화 결과물 기록
- 채널 목적에 맞는 Codex / Claude Code 자동화봇 실행
- 구매요청 채널: Mac mini 구매봇이 쿠팡/지마켓 등에서 후보를 준비하되 실제 결제 전 담당자 승인 대기
- 입고/출고/재고관리 채널: Ideas 내용을 연결된 스프레드시트에 반영하는 자동화 payload 생성
- 로그인 사용자 기준 메시지/게시글/댓글/봇 실행 요청자 기록
- Next.js API route + Prisma + SQLite 기반 상태 저장

## 실행 방법

Next.js 개발 서버:

```bash
npm install
npm run db:push
npm run dev
```

브라우저에서 엽니다.

```text
http://127.0.0.1:3000
```

첫 접속 시 `계정 생성`으로 직원 계정을 만들면 첫 사용자는 `admin` 역할이 됩니다. 이후 사용자는 같은 화면에서 계정을 생성하거나 로그인할 수 있습니다.

정적 목업만 확인하려면:

```bash
python3 -m http.server 4173
```

```text
http://127.0.0.1:4173
```

## 배포 실행

MVP 배포용 컨테이너를 만들 수 있습니다. 기본값은 SQLite이며 운영에서는 영속 볼륨이나 PostgreSQL 전환을 권장합니다.

```bash
docker build -t mattermost-project-mvp .
docker run --env-file .env -p 3000:3000 mattermost-project-mvp
```

영속 SQLite 볼륨까지 포함해 실행하려면:

```bash
docker compose up --build
```

상태 확인:

```text
GET /api/health
```

운영에서 첫 관리자 계정을 만든 뒤 공개 가입을 막으려면 환경 변수로 `ALLOW_PUBLIC_SIGNUP="false"`를 설정하세요. 첫 계정 생성은 항상 허용되고, 이후 계정 생성은 차단됩니다.

## API 시작점

개발 서버 실행 중에는 아래 API를 사용할 수 있습니다. 현재 MVP는 Prisma + SQLite를 사용하며, 로컬 DB 파일 `prisma/dev.db`는 Git에 포함하지 않습니다. `/api/auth/*`를 제외한 주요 API는 로그인 세션 쿠키가 필요합니다.

```text
GET    /api/auth/me
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/health
GET    /api/state
PUT    /api/state
DELETE /api/state
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId/channels
POST   /api/projects/:projectId/channels
POST   /api/channels/:channelId/messages
POST   /api/channels/:channelId/posts
POST   /api/channels/:channelId/files
POST   /api/channels/:channelId/bot-runs
PATCH  /api/posts/:postId
POST   /api/posts/:postId/comments
GET    /api/bot-runs/:runId
PATCH  /api/bot-runs/:runId
```

## 파일 구조

```text
app/
  layout.jsx
  page.jsx              Next.js 화면 상태 orchestration
  globals.css           정적 CSS import 및 Next 전용 보정 스타일
  api/                  인증, health check, Prisma 기반 API route
components/
  ProjectSidebar.jsx    프로젝트/채널 목록
  Topbar.jsx            채널 헤더와 탭
  MessagesView.jsx
  IdeasView.jsx
  PostCard.jsx
  FilesView.jsx
  AutomationPanel.jsx
  BotRunList.jsx
lib/
  constants.js          채널 타입, 탭, 상태 상수
  initialData.js        샘플 데이터와 생성 헬퍼
  automation.js         자동화 payload 및 실행 상태 헬퍼
  prisma.js             Prisma Client 싱글턴
  auth.js               비밀번호 해시, 세션 쿠키, 현재 사용자 헬퍼
  serverState.js        Prisma 기반 API 상태 읽기/쓰기 헬퍼
prisma/
  schema.prisma         MVP 데이터 모델
index.html              정적 목업
styles.css              공통 UI 스타일
app.js                  정적 목업 상태/상호작용
PLAN.md                 개발 계획
```

## GitHub

원격 저장소:

```text
https://github.com/one-moment/mattermost.git
```

브라우저 업로드 방식으로 이어갈 때는 이 폴더 전체를 저장소에 덮어쓰고 커밋하면 됩니다.
