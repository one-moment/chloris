# 개발계획

## 1. MVP 범위

현재 MVP는 Mattermost 기반 사내 프로젝트 커뮤니케이션 도구의 사용 흐름을 검증하는 데 초점을 둡니다.

포함 기능:

- 프로젝트 생성 및 선택
- 프로젝트별 Messages, Ideas, Files 상태 분리
- 프로젝트 내 Messages
- 프로젝트 내 Ideas 게시판
- 게시글 댓글 및 멘션
- 게시글 상태 변경
- 프로젝트 내 Files
- 파일 메타데이터 추가
- Codex, Claude Code, Custom Webhook 자동화봇 등록
- 자동화봇 명령어 실행과 결과 기록
- 맥미니 구매봇의 원격 브라우저 자동화 연동 개념
- 구매 준비, 승인 대기, 승인, 반려 상태 흐름

제외 기능:

- 칸반 Board
- 실제 Mattermost 서버 연동
- 실제 파일 업로드
- 실제 봇 실행 서버 호출
- 사용자 인증 및 권한 관리

## 2. 권장 아키텍처

```text
Frontend
- React 또는 Next.js
- 프로젝트/채널/게시판/파일/봇 관리 UI

Backend
- NestJS 또는 Spring Boot
- 프로젝트, 게시글, 댓글, 파일 메타데이터, 봇 설정 저장

Database
- PostgreSQL

Mattermost
- 사용자/채널/메시지/멘션/알림
- REST API, Webhook, WebSocket 연동

Automation
- Codex runner
- Claude Code runner
- Custom Webhook runner
```

## 3. 데이터 모델 초안

```text
projects
- id
- name
- mattermost_team_id
- mattermost_channel_id
- created_by
- created_at

posts
- id
- project_id
- title
- body
- status
- author_id
- created_at
- updated_at

comments
- id
- post_id
- body
- author_id
- parent_comment_id
- created_at

files
- id
- project_id
- post_id
- comment_id
- name
- storage_url
- source
- owner_id
- created_at

bots
- id
- project_id
- name
- provider
- command
- webhook_url
- enabled
- created_at

bot_runs
- id
- bot_id
- project_id
- input
- output
- status
- created_by
- created_at
```

## 4. 구현 마일스톤

### Phase 1: 프론트엔드 프로토타입 정리

- 현재 정적 MVP를 React/Next.js로 전환 완료
- 컴포넌트 분리 진행
- 샘플 데이터를 fixture로 분리
- 반응형 레이아웃 개선
- 프로젝트별 상태 관리 구조를 앱 상태 관리 라이브러리로 이전

### Phase 2: 백엔드 API

- 프로젝트 CRUD
- 게시글 CRUD
- 댓글 CRUD
- 파일 메타데이터 CRUD
- 봇 등록/수정/삭제
- 봇 실행 로그 저장

### Phase 3: Mattermost 연동

- 프로젝트 생성 시 Mattermost 채널 생성
- 프로젝트 멤버를 채널에 추가
- 게시글/댓글/봇 실행 결과를 Mattermost 메시지로 알림
- Mattermost 멘션과 앱 멘션 매핑

### Phase 4: 자동화봇 연동

- Codex 실행 서버 연결
- Claude Code 실행 서버 연결
- Custom Webhook 실행
- 봇 실행 권한과 감사 로그 추가
- 실행 결과를 Messages, Ideas, Files에 연결
- Webhook payload 검증 및 재실행 기능 추가
- 실행 상태를 대기, 실행중, 성공, 실패로 표준화
- 맥미니 구매봇 Webhook 연결
- 쿠팡/지마켓 브라우저 자동화는 장바구니/결제 직전 단계까지만 허용
- 담당자 승인 후 사람이 최종 결제하고 주문번호를 기록

### Phase 5: 사내 배포

- SSO 또는 Mattermost 계정 연동
- 권한 모델
- 파일 저장소 연결
- 운영 모니터링
- Docker 배포 구성

## 5. GitHub 저장 후 맥북에서 이어가기

맥북에서 다음 순서로 이어갈 수 있습니다.

```bash
git clone <github-repo-url>
cd mattermost-project-mvp
python3 -m http.server 4173
```

브라우저에서 엽니다.

```text
http://127.0.0.1:4173
```
