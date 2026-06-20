# STATE — 클로리스 (통합 멀티컴퍼니 플랫폼)

갱신일: 2026-06-20 · 브랜치: `feature/ledger-settlement-mvp` (통합본, origin 추적) · 동반: [ROADMAP.md](ROADMAP.md) · 정본 진행기록: [HANDOFF.md](HANDOFF.md)·[TODO.md](TODO.md)·[DECISIONS.md](DECISIONS.md)

```RESUME
현재 Phase:
  Phase F → G 전환점. 오늘꽃 정산 자동화 "단계 0(수집 어댑터)" 완료,
  "단계 1(매입 계산서 대조)" 착수 전. 이 브랜치는 통합 플랫폼 전체를 포함한다.

이 Phase 목표:
  팝빌로 홈택스 매입 계산서·은행 입금 내역을 자동 수집·대조하여,
  거래원장(구글 시트)과 앱에 "계산서 확인 / 입금 확인 / 잔여 정산금액 / 확인 필요"를
  자동 표시한다. 실제 송금·예외 점검만 사람이 한다.

바로 다음 할 일 (단계 1):
  0) npm install (통합본 의존성과 로컬 node_modules 동기화) — 빌드/실행 전 필수.
  1) (입력 대기) 거래원장 시트 칸 구성(사입/납품 제목 행) + 팝빌/홈택스 부서계정/계좌 준비.
  2) 시트 읽기/되써넣기: 기존 lib/googleSheets.js + inventorySheetSync/crmReservationSheetSync 패턴 재사용.
  3) Prisma 모델 PurchaseInvoice·CollectionJob (schema.prisma + schema.postgres.prisma) + 마이그레이션.
  4) lib/reconcile.js 매입 대조(키: 공급자 사업자번호 + 합계금액 + 작성일자±N일).
  5) settlement API: 수집(홈택스)→폴링→대조→목록 (기존 app/api/work/* 패턴 + 관리자 게이팅).
  6) 정산 콘솔: modules/ + registry 패턴(브랜드 게이팅 todaykkot).
  ※ 각 단계 착수 전 "변경 파일·이유 설명 → 승인" 게이트 유지. 운영 DB로 테스트 금지.

막힌 것 (블로커):
  - 팝빌 테스트베드/홈택스 부서계정/계좌 등록 미완 → 라이브 수집/대조 검증 불가. (담당자 준비물)
  - 거래원장 시트 칸 구성 미제공 → 대조 컬럼 매핑·되써넣기 설계 보류.
  - 로컬 node_modules가 통합본 package.json과 불일치 → npm install 전 lint/build 불가.
  - (병행, 내 작업 아님) 헤르메스 1~3단계 "사람 검증 + PR"이 HANDOFF에 대기 중.
  - 이 브랜치는 외부에서 force-push된 이력 있음(아래) → 푸시 전 항상 git fetch로 최신 확인.
```

---

## 보조 컨텍스트

### 브랜치/이력 주의 (force-push 충돌 정리됨, 2026-06-20)
- origin `feature/ledger-settlement-mvp`가 **외부(다른 PC/Ralph 루프 추정)에서 통합 코드베이스로 force-push**됨.
- 내 이전 로컬 라인(popbill 설치·정산 어댑터·옛 STATE/ROADMAP)은 origin에 **이미 재적용**되어 있고, 추가로 백업 보존:
  - 로컬 백업 브랜치: `feature/ledger-settlement-mvp-local-backup`
  - 원격 보존 태그: `archive/ledger-settlement-mvp-prerebase-2026-06-20`
- 이 워크트리는 origin 통합본으로 전환 완료(reset --hard/force-push 미사용). **공유 브랜치이므로 푸시 전 `git fetch` 필수.**

### 정산 코드 현황 (이 브랜치 실측)
- 있음: `lib/popbill.js`·`lib/popbillBank.js`·`lib/popbillHomeTax.js`, `scripts/settlement-probe.mjs`, `lib/googleSheets.js`(+CRM/인벤토리 시트 sync), `.env.example`(POPBILL_*).
- **아직 없음**: settlement 전용 Prisma 모델·마이그레이션, `lib/reconcile.js`, `app/api/settlement/*`, 정산 콘솔 모듈/UI. → Phase G~I.
- 코드 내 TODO/FIXME: 없음. (이전 모놀리식의 봇 시뮬레이션은 통합본에서 실제 모듈/에이전트로 대체됨)

### 확정 결정 (정산)
- 분기: 통합본 위 `feature/ledger-settlement-mvp`. 결과: 구글 시트 되써넣기 + 앱 정산 콘솔(예외/별칭, 앱 DB 저장). 수집: MVP 수동 버튼, 크론 후속.
- 진행: 단계별+승인 게이트, 시크릿 `.env`만, PII 로그/커밋 금지, 실제 송금은 사람, 운영 배포·운영 DB 테스트는 별도.

### 병행 트랙
- 오늘꽃 정산(현재) · 계산서 발행(보류, Phase K) · 헤르메스 검증(HANDOFF) · 모듈(CRM/인벤토리/구매/analytics, 대부분 운영).
