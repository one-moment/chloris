# 채널 멤버십 기능 — 작업 체크리스트

브랜치: `feature/channel-membership`
환경: DELL(Node 없음) → 정적 검증만, 실행 테스트는 Mac.

## 확정 설계 (사용자 승인)
- 멤버십 등록·관리만. 채널 가시성/접근 제한은 **추가하지 않음**(기존 유지).
- 상태 3종: `active`(정식) / `pending`(참가대기) / `invited`(초대됨).
- 권한: 전역 admin OR 해당 채널 멤버십 `role==="owner"`.
- 초대 → `invited` → 사용자가 직접 **수락** → `active`.
- 참가요청 → `pending` → 관리자 **승인** → `active` / **거절** → 삭제.

## 단계
- [x] 1. ChannelMember 모델 추가 (schema.prisma)
- [x] 2. User 모델 역참조 추가 (schema.prisma)
- [x] 3. 운영 스키마(schema.postgres.prisma) 동일 적용 (모델 + 역참조 2곳)
- [x] 4. 운영용 마이그레이션 SQL 파일 작성 (20260616000000_add_channel_member)
- [x] 5. 권한 헬퍼 (lib/permissions.js) + lib/channelMembers.js
- [x] 6. 채널 생성자 owner 자동 등록 (생성 라우트 2곳)
- [x] 7. API 라우트 (멤버 목록/초대 + 참가요청 + 초대수락 + 승인·거절 + self-status me)
- [x] 8. UI: ChannelMembersPanel.jsx + Topbar 버튼 + app/page.jsx 연동 + CSS
- [x] 9. 정적 검증 (서브에이전트 적대적 리뷰 4차원 → 8건 발견·수정 → 회귀 재검증 PASS)
- [x] 10. 한국어 커밋

## 리뷰 반영 내역 (8건)
- HIGH: writeState() cascade로 멤버십 전손실 → 스냅샷 후 복원
- HIGH: 채널/프로젝트 생성 시 addOwnerMembership 실패가 생성을 500으로 깸 → best-effort(try/catch)
- MED: 참가요청/초대 findUnique→create 경합(P2002) → 친화적 400 변환
- LOW: self-invite 가드, 검색 stale 결과 차단, 닫기 버튼 스타일, Topbar 정렬

## Mac 검증 체크리스트 (커밋 후)
- `npm install` (필요 시) → `npx prisma db push` (dev SQLite 스키마 반영)
- `npm run dev` 후 수동 시나리오: 초대→수락, 참가요청→승인/거절, 권한 없는 사용자 차단
- 운영: `schema.postgres.prisma` 기준 마이그레이션 적용
