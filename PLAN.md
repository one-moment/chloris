# 개발계획

## 1. MVP 범위

현재 MVP의 핵심은 “프로젝트 안에 여러 채널을 만들고, 각 채널에서 Messages / Ideas / Files를 함께 쓰는 업무 공간”입니다. 구매요청은 여러 채널 목적 중 하나이며, 일반 소통 채널과 입고/출고/재고관리 채널도 같은 구조 안에서 동작합니다.

포함 기능:

- 프로젝트 생성 및 선택
- 프로젝트별 채널 생성
- 채널별 Messages, Ideas, Files 데이터 분리
- 채널 유형: 일반 소통, 구매요청, 입고, 출고, 재고관리
- Ideas 게시글 작성, 댓글, 멘션, 상태 변경
- Files 메타데이터 추가
- Codex, Claude Code 자동화봇 연결 개념
- 자동화봇 실행 로그와 payload 확인
- 구매요청 채널의 Mac mini 구매봇 원격 브라우저 자동화 개념
- 구매봇은 장바구니/결제 검토 단계까지만 진행하고, 최종 결제는 담당자 승인 후 진행
- 입고/출고/재고관리 채널은 Ideas 내용을 스프레드시트에 반영하는 자동화 payload 생성

제외 기능:

- Kanban board
- 실제 Mattermost 서버 연동
- 실제 파일 업로드
- 실제 봇 실행 서버 호출
- 사용자 인증 및 권한 관리
- 실제 결제 자동 실행

## 2. 현재 프론트엔드 구조

```text
app/page.jsx
- Next.js 앱의 상태 관리와 액션 orchestration

components/
- ProjectSidebar: 프로젝트/채널 선택
- Topbar: 채널 제목, 채널 타입, 탭
- MessagesView: 채팅
- IdeasView: 게시판
- PostCard: 게시글/댓글
- FilesView: 파일 목록
- AutomationPanel: 채널별 자동화 실행
- BotRunList: 실행 이력, payload, 승인/반려

lib/
- constants: 채널 타입, 탭, 게시글 상태
- initialData: 샘플 데이터와 생성 함수
- automation: 자동화 payload, 실행 상태 전환
```

## 3. 권장 데이터 모델 초안

```text
projects
- id
- name
- description
- created_by
- created_at

channels
- id
- project_id
- name
- type
- mattermost_channel_id
- created_at

messages
- id
- channel_id
- body
- author_id
- bot_id
- created_at

posts
- id
- channel_id
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
- created_at

files
- id
- channel_id
- post_id
- name
- storage_url
- source
- created_at

bots
- id
- name
- provider
- command
- channel_types
- webhook_url
- enabled

bot_runs
- id
- bot_id
- channel_id
- input_payload
- output_payload
- status
- approval_status
- created_by
- created_at
```

## 4. 다음 구현 단계

### Phase 1: 프론트엔드 정리

- Next.js 앱에 최신 채널 중심 모델 반영 완료
- 컴포넌트 분리 완료
- 샘플 데이터와 자동화 payload 로직을 `lib`로 분리 완료
- 다음 작업: 타입 정의 또는 TypeScript 전환, 테스트 가능한 순수 함수 확대

### Phase 2: 백엔드 API

- 프로젝트 CRUD
- 채널 CRUD
- 메시지 CRUD
- 게시글/댓글 CRUD
- 파일 메타데이터 CRUD
- 봇 등록 및 실행 로그 저장

### Phase 3: Mattermost 연동

- 프로젝트 생성 시 Mattermost 팀/채널 생성
- 채널 멤버 관리
- 게시글/댓글/봇 실행 결과를 Mattermost 메시지로 알림
- Mattermost 멘션과 앱 멘션 매핑

### Phase 4: 자동화봇 연동

- Mac mini 구매봇 실행 서버 연결
- 구매봇 원격 브라우저 세션 상태 표시
- 결제 직전 승인/반려 워크플로우
- 입고/출고/재고관리 스프레드시트 API 연결
- 봇 실행 권한, 감사 로그, 재시도 기능

### Phase 5: 사내 배포

- SSO 또는 Mattermost 계정 연동
- 권한 모델
- 파일 저장소 연결
- Docker 배포 구성
- 운영 모니터링
