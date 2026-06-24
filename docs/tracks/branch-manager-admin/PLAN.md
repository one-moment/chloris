# PLAN v5 — 지점 매니저 관리 (Branch Manager Admin)

> **트랙:** `docs/tracks/branch-manager-admin/` (#28 또는 다음 번호)
> **선행/연결:** #27 폐기 검수·승인 (승인·검증 경로 직접 수정 — §4)
> **단계:** 기획(사무실 PC) → 실행(Mac, Claude Code)
> **v5 변경 요지:** STATE(§9-1) 조사 반영 — 듀얼 스키마 **drift 없음** 확인 / #27 두 함수의 `if(!branchId)` **early-가드 함정**을 §4·§9-5에 명시 / 박선영 실데이터는 **운영 DB 전용**(워크트리·로컬 dev.db 조회 불가)이라 정합 절차·자격증명 주의를 §3에 명시. 구조 변경 0. (v4: supervisor 라벨화. v3: 권한 2축 + 박선영 admin+(manager,flag) + 지적 A~F.)

---

## 0. 확정 사항 (조사·결정 완료)

**조사 결과 (Claude Code)**
- 매니저 저장 = `BranchAssignment(role="manager")` 행. 신규 테이블 불필요. — `prisma/schema.prisma:31`
- 지점 마스터 = `Branch` 존재. 단 `/api/branches` 없음 → 신규 필요. — `prisma/schema.prisma:20`
- admin 판별 = `user.role === "admin"`. 표준 가드: `requireCurrentUser()` → 401 → `role!=="admin"` → 403. — `lib/auth.js:108`
- #27 = `canApproveDisposal()`(승인) / `branchManagers()`(reviewer 풀) 이 `role==="manager"` + 전역 admin 을 읽음. — `lib/inventoryServer.js:55-94`
- ⚠️ **권한 2축**: `User.role`(전역, admin 판별) ⟂ `BranchAssignment.role`(지점별, manager/staff) = 독립 필드. reviewer 풀은 `BranchAssignment.role="manager"`만 거름 → **admin은 reviewer 풀에 안 잡힘**.
- ⚠️ 듀얼 스키마 = `schema.prisma`(SQLite) + `schema.postgres.prisma`(운영) 둘 다 유지.
- UI 본보기 = `app/(workspace)/work/inventory/masters/page.jsx`

**결정**
1. 전 지점 = `isAllBranches` 플래그 (신규 지점 자동 포함)
2. 지정 대상 = 기존 사용자만 (초대 플로우 무수정, 사용자 검색 API만 추가)
3. 역할 = `BranchAssignment(role="manager")` 단일 통합 (#27과 동일 + 플래그 OR 조건)
4. 해제 = `manager` → `staff` 강등 (행 삭제 X, `is_active` 컬럼 X, 되돌리기 가능)
5. 배치 = 코어 admin 영역 + 보로 게이팅 (의사 슬러그 `"branch-admin"` 방식 — §7)
6. **박선영 셋업 = 두 축 동시 부여**
   - `User.role = "admin"` → 시스템 관리(타 직원 매니저 지정·해제) + 전 지점 폐기 **승인** 자동(`canApproveDisposal` 통과)
   - `BranchAssignment(role="manager", isAllBranches=true, branchId=null)` → 전 지점 폐기 **reviewer 지정 가능**(admin만으론 reviewer 풀 미포함)
   - 플래그의 역할: 박선영껜 'reviewer 풀 노출'용. admin이 아닌 미래 감독자에겐 승인+reviewer 양쪽 핵심.
7. **수퍼바이저 = '비admin 전 지점 매니저'의 UI 라벨.** 새 role/enum/컬럼 없음 — `role="manager"` + `isAllBranches=true` + `User.role≠"admin"` 조합이 곧 supervisor. **이번 트랙에서 데이터 메커니즘이 그대로 제공됨**(지정 화면에서 비admin 사용자에 '전 지점' 토글 → supervisor 생성). 후속으로 미루는 건 오직 '폐기 외 도메인까지 가진 **전역 supervisor role 티어**'뿐.

## 1. 배경
- 박선영 지정을 DB 직접 처리함. 코드/DB 손대지 않고 매니저를 관리할 화면이 없음.
- #27로 권한 주체가 명확해질 필요 → 이미 `BranchAssignment`로 통합돼 있어 UI만 씌우면 됨.
- 보로(다지점) 성장 → 임명/해제/범위 변경 반복 업무 → 셀프서비스화. supervisor도 이 화면 데이터로 표현.

## 2. 목표 / 범위
**포함**: 매니저 목록 조회(지점·상태 필터, 검색) / 지정(기존 사용자 검색 + 지점 또는 전 지점) / **비admin 사용자를 전 지점 매니저(=supervisor)로 지정** / 지점 범위 수정 / 해제(staff 강등) / 감사 기록(마지막 변경자·시각)
**제외**: 사용자 초대·가입(기존 사용자만) / 매니저 본인 대시보드 / **전역 supervisor role 티어(폐기 외 도메인 확장)** / append-only 감사 이력

## 3. 데이터 모델 (BranchAssignment 재사용 + 지적 B/C/E 반영)

기존:
```
BranchAssignment { id, userId, branchId, role @default("staff"), createdAt
                   branch Branch @relation(onDelete: Cascade) }
@@unique([userId, branchId])
```

추가 / 변경 — **이번 트랙 유일한 스키마 변경**:
- `isAllBranches Boolean @default(false)` — 전 지점 매니저 플래그
- `assignedById String?` (FK → User) — 지정한 관리자
- `updatedAt DateTime @updatedAt`
- (선택) `updatedById String?`
- ⚠️ **[C] branchId nullable화**: `branch Branch @relation(onDelete: Cascade)` → `branch Branch? @relation(onDelete: SetNull)`. 전 지점 행은 `branchId=null`이므로 필수. 듀얼 스키마 둘 다.

**[B] 유니크/불변식 가드 (Prisma `@@unique`로는 못 막음)**
- `@@unique([userId, branchId])`는 SQLite·Postgres 공통으로 **NULL을 서로 다른 값으로 취급** → 전 지점 행(`branchId=null`) 중복을 못 막고, 특정지점 행과 충돌도 안 남. 결과: ① 전 지점 행 다중 누적 가능 ② 전 지점 행 + 특정지점 행 모순 공존 가능.
- → **앱 레벨 유니크 가드**: POST/PATCH에서 "해당 사용자에 이미 전 지점 행 있으면 거부".
- → **상호배타 불변식**: `isAllBranches=true` 행과 그 사용자의 특정지점 행은 공존 금지 (전 지점 지정 시 기존 특정지점 행 정리, 또는 거부).
- (선택) DB로 강제하려면 Postgres **부분 유니크 인덱스**를 raw SQL 마이그레이션으로. 1차엔 앱 레벨로 충분.

**[E] 감사 범위 = 마지막 변경 (이력 아님 — 의식적 선택)**
- `updatedAt`/`updatedById`는 가변 행 1개를 덮어씀 → 지정→강등 시 이전 기록 소멸. "누가 마지막에 건드렸나"는 남지만 *trail*은 아님.
- 보로 규모에선 **마지막-변경 캡처로 충분**으로 결정. 진짜 append-only 이력이 필요해지면 별도 로그 트랙(이번 범위 밖).
- → §10 "감사 기록"은 '마지막 변경자/시각'으로 정의.

**박선영 데이터 정합** (스키마 아님 = 데이터 변경, 사인오프 대상)
- ⚠️ **박선영 계정·배정은 운영 DB에만 수기 존재** (워크트리·로컬 `dev.db` 없음, STATE 확인). 현황은 **운영자가 운영 콘솔(Supabase/Vercel Postgres)에서 read-only SQL을 직접 실행**해 `User.role`·`branchId`·`role` 값만 회수 (STATE에 SQL·표 준비됨). **운영 자격증명을 채팅·코드·repo·`.env.local`에 넣지 말 것** — 결과 값만 회수.
- 회수 값 기준: 이미 `role="admin"`이면 **승격 생략**. 아니면 `User.role` → `"admin"`.
- `BranchAssignment` 행 → `isAllBranches=true`, `branchId=null`로 갱신.
- 이 정합은 스키마 변경(§9-2)과 **독립** — 스키마 작업은 박선영 데이터 없이 선행 가능(병렬 트랙).

## 4. #27 승인·검증 경로 연동 ([A] — 확대, 함정 회피)

플래그 OR 조건을 **두 함수 모두**에 추가 (`lib/inventoryServer.js:55-94`):
- `canApproveDisposal()` — 승인 권한
- `branchManagers(branchId)` — **reviewer 풀**. 이걸 안 고치면 기능 버그:
  - `app/api/work/inventory/disposals/route.js:79` — 전 지점 매니저를 담당자(reviewerId)로 지정 시 "해당 지점 매니저여야" 거부됨
  - `app/api/work/inventory/disposals/[batchId]/route.js:136` — 승인 알림 대상에서도 누락
- 수정(개념): `branchManagers(branchId)` = `where { role:"manager", OR:[{ branchId }, { isAllBranches:true }] }`
- ⚠️ **early-가드 함정 (STATE 확인):** 두 함수 모두 `if(!branchId)` early-return 존재 (`branchManagers`→`[]` `L56` / `canApproveDisposal`→admin 외 false `L85`). **early-return 분기는 그대로 두고 그 아래 where절만 OR로 교체** — branchId 없이 부르는 소비처의 기존 동작 보존 + 전 지점 매니저가 정상 호출에서만 잡히도록. 소비처 3곳(`L64` 승인 / `L79` reviewer 검증 / `L136` 알림)이 branchId를 항상 주는지 회귀로 확인.

**회귀 테스트 (필수 — 승인 경로 변경)**
- 특정 지점 매니저: 그 지점만 reviewer 드롭다운·검증·승인
- 전 지점 매니저(=admin 박선영 또는 비admin supervisor): **모든 지점**의 reviewer 드롭다운·검증·승인에 노출
- admin: 전 지점 승인 (reviewer 풀 노출은 manager 행 있을 때만)

## 5. 권한 / 보안
- 화면·전 API = 표준 admin 가드(`requireCurrentUser()` → 401 → `role!=="admin"` → 403). **서버 측 필수.**
- 비 admin 매니저는 가드에서 자동 차단 → 매니저 관리 화면 접근·권한 상승 불가.
- 박선영은 admin이므로 이 화면 접근 = **의도된 것**(시스템 관리 권한). admin은 매니저 관리보다 넓은 권한임을 인지(타 admin 기능 포함).
- **supervisor(비admin 전 지점 매니저)는 이 화면에 접근 불가** — admin 가드이기 때문. 즉 supervisor는 전 지점 폐기를 *승인*하지만 다른 매니저를 *지정·해제*할 순 없음. admin↔supervisor 경계 = 의도된 분리(권한 상승 차단과 정확히 일치).
- 모든 변경에 감사 기록(`assignedById` / `updatedById`).

## 6. 화면 (본보기: inventory/masters)
1. **매니저 목록** — 이름 / 연락처 / 담당 지점(칩) / 역할 뱃지 / 상태 / 최근 변경. 지점·상태 필터, 검색.
   - 역할 뱃지: 전 지점 행이 **비admin이면 `supervisor`**, **admin이면 `전 지점 매니저(admin)`**(박선영), 특정지점이면 지점 칩만.
2. **매니저 지정** — 기존 사용자 검색 → 선택 → 지점 다중선택 또는 '전 지점' 토글 → 확인.
   - '전 지점' 토글은 **admin 여부와 무관하게 허용**(비admin에 토글 시 supervisor 생성). 전 지점 선택 시 [B] 불변식: 기존 특정지점 행 정리.
3. **수정/해제** — 지점 범위 변경, '해제'(staff 강등) 확인 다이얼로그. 하드 삭제 없음.

## 7. API (지적 F 반영)
- `GET /api/branches` **(신규)** — 지점 드롭다운용. `status="active"` 목록.
- 사용자 검색 API **(신규)** — 기존 사용자 이름/이메일 검색. 지정 대상 선택용.
- 매니저 목록 `GET` / 지정 `POST`(불변식 가드 포함) / 범위 수정 `PATCH` / 해제 `PATCH`(staff 강등)
- 전부 표준 admin 가드 + 입력 검증.
- **[F] brand 게이팅**: `isModuleEnabled(slug)`는 모듈 슬러그 기반(`lib/brand.js:40`)인데 매니저 관리는 코어=슬러그 없음 → borough `modules` 배열에 **의사 슬러그 `"branch-admin"` 등록 후 `isModuleEnabled("branch-admin")`**. (기존 게이팅 관례와 일관 — (a)안. `ACTIVE_BRAND_SLUG` 직접 체크는 비채택.)

## 8. 마이그레이션 / 운영 주의 (지적 D 반영)
- 스키마 변경 = 컬럼 추가 + `branchId` nullable + `onDelete` 변경 → ⚠️ **듀얼 스키마 둘 다.** (STATE: drift 없음 확인 — 두 파일에 동일 내용 적용하면 됨.)
- ⚠️ **[D]** Prisma 생성 SQL은 `IF NOT EXISTS` 미포함 → **Postgres 마이그레이션 SQL 수동 보정**(`ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`)으로 idempotent 충족. (SQLite는 dev 전용 — 사인오프가 실제 지키는 건 Postgres.)
- 운영 마이그레이션 **선적용 → 검증 → 배포** (지난 '선적용 누락' 사고 방지).
- 배포 후 health 체크.
- ⚠️ **별도 마이그레이션 사인오프 필요** (스키마 변경 + 박선영 admin 승격 데이터 변경, 실행 전 승인).

## 9. 작업 순서 (Claude Code)
1. 박선영 행 `branchId` + `User.role` 현황 + 듀얼 스키마 확인 → `STATE.md` **(읽기 전용, 사인오프 불필요)**
2. 스키마: `isAllBranches`/`assignedById`/`updatedAt` 추가 + `branchId` nullable + `onDelete: SetNull` (두 파일) + 마이그레이션 작성(PG는 `IF NOT EXISTS` 수동) → **사인오프 대기** → 선적용·검증
3. `GET /api/branches` + 사용자 검색 API (admin 가드)
4. 매니저 CRUD API (admin 가드, [B] 불변식 가드 포함)
5. `canApproveDisposal()` + `branchManagers()` **둘 다** `isAllBranches` OR 추가 — ⚠️ 둘 다 `if(!branchId)` early-가드 존재, **early-return 유지 + 아래 where절만 OR 교체**(STATE 메모) + 회귀 테스트 ([A])
6. 관리자 UI 3화면 (borough 의사 슬러그 게이팅, [F], supervisor/admin 뱃지 구분)
7. 박선영 데이터 정합: **운영 SQL 회수 값 기준** — `User.role="admin"`(이미면 생략) + 행 `isAllBranches=true`/`branchId=null` (데이터 변경, 사인오프). 스키마 작업과 **병행 가능**.
8. 스모크 테스트 — 박선영이 매니저 관리 화면 접근 + **모든 지점 reviewer로 노출** + 지정/수정/해제 동작 + (선택) 비admin 사용자에 전 지점 토글 시 supervisor 생성·승인 확인

## 10. 완료 기준
- admin이 코드/DB 직접 수정 없이 매니저 지정·수정·해제 가능
- 박선영이 매니저 관리 화면 접근 + 모든 지점 폐기 reviewer로 지정·노출 (내일 스모크 테스트)
- 비admin 사용자를 전 지점 매니저(=supervisor)로 지정 가능, 목록에 `supervisor` 뱃지로 구분
- `isAllBranches`가 #27 **승인 + reviewer 풀 둘 다**에 정확 반영 (회귀 통과)
- supervisor는 폐기 승인은 되지만 매니저 관리 화면은 차단됨 (admin 경계 유지)
- 비 admin은 매니저 관리 API에서 서버 단 차단 (UI 우회 불가)
- 모든 변경에 '마지막 변경자/시각' 감사 기록 ([E])
- 운영 배포 후 health ok

## 11. 범위 밖 / 후속
- **전역 supervisor role 티어**: 별도 트랙 (폐기 외 도메인 확장 시). 직급의 운영 실체(전 지점 폐기 감독)는 이번 트랙 flag로 **이미 가능** — 후속은 도메인 확장뿐.
- **append-only 감사 이력**: 별도 로그 트랙 (필요 시).
- **[B] DB 강제 부분 유니크 인덱스**: 앱 레벨 가드로 부족할 때 raw SQL로 승격.
