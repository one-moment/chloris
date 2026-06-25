# STATE — 지점 매니저 관리 (Branch Manager Admin)

> 트랙: `docs/tracks/branch-manager-admin/` · 브랜치: `feat/branch-manager-admin`
> 단계: **§9-1 조사 (읽기 전용) 완료 — 2026-06-25**
> 정지점: **§9-2(스키마 변경) 직전.** 마이그레이션 작성 후 적용 전 사인오프 필요. 코드/스키마/DB 변경 0.

## 0. 이번 조사 범위 (PLAN v4 §9-1)
① 박선영 `BranchAssignment` 행(branchId·role) ② 박선영 `User.role` ③ 듀얼 스키마 대조 ④ `canApproveDisposal()`/`branchManagers()` 시그니처·where 재확인. — **읽기 전용.**

---

## 1. 환경 사실 ⚠️ (핵심 발견)
- 로컬 dev DB = `file:./dev.db` (SQLite) — **이 워크트리엔 파일 없음**(미생성·미시드).
- 운영 DB = Supabase Postgres(`schema.postgres.prisma`). 워크트리 shell `DATABASE_URL` **미설정**, `.env.local` 없음 → **운영 조회 불가.**
- `scripts/seed-local.mjs` = **지점 3개만** 시드(강남1호점 `branch-gangnam-1` / 강남2호점 `branch-gangnam-2` / 잠실점 `branch-jamsil`). **사용자·매니저 배정은 시드 안 함** → 로컬 시드해도 박선영 없음.
- repo 내 "박선영" 언급은 전부 **재고 표준(구분/원인)** 문맥(`lib/inventory.js`, `docs/inventory-stockin-disposal.md`) — 그녀의 user 계정/배정은 시드·코드 어디에도 없음(**운영 DB에 수기 삽입됨**).

### ⇒ §9-1 ①②는 워크트리에서 확정 불가 — 운영 read-only 조회 필요
운영 `DATABASE_URL` 확보 후(또는 운영 접근 가진 운영자가) 아래 **읽기 전용** 쿼리 실행 → §2 표 채움. 이건 데이터 조회일 뿐, 변경 아님:

```sql
-- 박선영 user + 전역 role
SELECT id, name, handle, email, role FROM "User" WHERE name = '박선영';

-- 박선영 BranchAssignment 행(현재 branchId·role)
SELECT ba.id, ba."userId", ba."branchId", ba.role, b.name AS branch_name
FROM "BranchAssignment" ba
LEFT JOIN "Branch" b ON b.id = ba."branchId"
JOIN "User" u ON u.id = ba."userId"
WHERE u.name = '박선영';
```

| 항목 | PLAN 기대 | 운영 실측 | 영향 |
|---|---|---|---|
| 박선영 `User.role` | `admin`(승격 대상) | **❓ 미확인** | 이미 admin이면 §9-7 role 변경 **불필요** |
| 박선영 `BranchAssignment.branchId` | 특정 지점 1개 → `null`로 정합 예정 | **❓ 미확인** | nullable화 후 `isAllBranches=true` |
| 박선영 `BranchAssignment.role` | `manager` | **❓ 미확인** | manager 아니면 정합 시 교정 |
| 박선영 `BranchAssignment` 행 개수 | 1 | **❓ 미확인** | 복수면 [B] 불변식 정리 대상 |

---

## 2. 듀얼 스키마 대조 — ✅ 일치 (drift 없음)
`schema.prisma`(SQLite) ↔ `schema.postgres.prisma`(Postgres)의 `Branch`·`BranchAssignment` 정의 **완전 동일**(postgres 파일 선행 빈 줄 1개 외 차이 없음).

**`Branch`**: `id @id`, `name @unique`, `slug @unique`, `status @default("active")`, `createdAt`, `updatedAt`, `channels[]`, `assignments BranchAssignment[]`

**`BranchAssignment`**:
- `id @id`, `userId`, `branchId` **(현재 非 null)**, `role @default("staff")`, `createdAt`
- `user User @relation(onDelete: Cascade)`, `branch Branch @relation(onDelete: Cascade)`
- `@@unique([userId, branchId], map: "uniq_branch_assignment")`

⇒ §9-2 변경(`isAllBranches`/`assignedById`/`updatedAt`/`updatedById` 추가 + `branchId` nullable + `branch` `onDelete: SetNull`)은 **두 파일에 동일 적용**. 현재 동일하므로 drift 위험 없음.

---

## 3. #27 함수 현재 시그니처·where (`lib/inventoryServer.js`) — ④
- `branchManagers(branchId)` (L56) — `if (!branchId) return []` → `findMany where { branchId, role:"manager" }` → `[{id,name,handle}]`.
- `allBranchManagers()` (L69) — `findMany where { role:"manager" }` → `[{branchId,id,name,handle}]`.
- `canApproveDisposal(user, branchId)` (L85) — `if(!user) return false; if(user.role==="admin") return true; if(!branchId) return false;` → `findFirst where { userId:user.id, branchId, role:"manager" }`.

**소비처(읽기 확인):**
- `app/api/work/inventory/disposals/route.js:79` — reviewerId가 그 지점 매니저인지 검증(`branchManagers`).
- `app/api/work/inventory/disposals/[batchId]/route.js:136` — 승인 알림 대상(`branchManagers`).
- `app/api/work/inventory/disposals/[batchId]/route.js:64` — 승인/반려 권한(`canApproveDisposal`).

⇒ §9-5에서 `branchManagers`·`canApproveDisposal` 둘 다 `OR isAllBranches=true` 추가.
**주의(설계 메모):** 두 함수의 early `if(!branchId)` 가드 — 호출부는 항상 `batch.branchId`가 존재하므로 동작엔 문제 없으나, all-branches OR 추가 시 분기 위치를 재배치해 "branchId 있는 batch에 대해 전 지점 매니저가 잡히도록" 해야 함. (`allBranchManagers()`는 이미 branchId 무관이라 그대로.)

---

## 4. 진행 상태
- ✅ §9-1 조사 (위)
- ✅ **§9-2~§9-6 작성 완료** (2026-06-25, 아래 §5). 마이그레이션은 **작성만** — 적용·배포 안 함.
- ⛔ **§9-2 적용(선적용)·배포는 사인오프 대기.** (PG 마이그레이션 `IF NOT EXISTS` 수동 보정 완료)
- ⏸ **§9-7 박선영 데이터 정합**: 운영 read-only SQL(§1) 회수 값 받은 뒤 별도. 박선영이 이미 admin이면 role 변경 생략.

## 5. 구현 요약 (§9-2~§9-6)
**스키마 [§9-2]** — `BranchAssignment`에 추가/변경 (두 파일 동일):
- `isAllBranches Boolean @default(false)`, `assignedById String?`, `updatedById String?`, `updatedAt DateTime @updatedAt`
- `branchId` → nullable, `branch Branch?` **`onDelete: Cascade` 유지(v6 정정)**. SetNull 비채택 — 특정지점 삭제 시 `isAllBranches=false`+`branchId=null` 유령 행 생성 → 불변식[B] 위반. 전 지점 행은 branchId=null이라 FK 무관.
- ⚠️ **결정: `assignedById`/`updatedById`는 FK 없는 scalar TEXT** — disposal-review(`approvedById` 등) 관례 일치 + 실제 FK화는 `User↔BranchAssignment` 기존 관계 개명(범위 밖 리팩토링)을 강제하므로 회피. PLAN §3 "FK→User"는 의미상 표기로 해석.
- 마이그레이션: `prisma/migrations/20260625120000_add_branch_manager_fields/migration.sql` (Postgres 전용 — SQLite는 `db push`. **v6: FK 안 건드림 — 컬럼 4개 `ADD COLUMN IF NOT EXISTS` + `branchId` `ALTER COLUMN DROP NOT NULL`(재실행 no-op)만**).

**API/로직 [§9-3·4]**
- `lib/branchManagerAdmin.js` (코어): `listManagers`/`assignManager`/`updateManagerScope`/`unassignManager` + 불변식[B] 재조정(`reconcileScope`) + `isMissingBranchManagerSchema` degrade.
- `app/api/branches/route.js` (GET, admin+게이팅) — 드롭다운용. **사용자 검색은 기존 `GET /api/users?query=` 재사용**(신규 X).
- `app/api/branch-managers/route.js` (GET 목록 / POST 지정), `app/api/branch-managers/[userId]/route.js` (PATCH 범위수정·해제). 전부 표준 admin 가드 + `isModuleEnabled("branch-admin")`.

**#27 연동 [§9-5]** — `lib/inventoryServer.js`:
- `branchManagers()`·`canApproveDisposal()` 둘 다 early-return 유지 + where절만 `OR:[{branchId},{isAllBranches:true}]` 교체.
- `allBranchManagers()` 전개(§7 갭 해결) — 전 지점 매니저를 활성 지점마다 1행으로 펼쳐 폼 드롭다운 노출(사용자 승인 후 추가).
- 회귀 테스트: `scripts/test-branch-manager.mjs` (12케이스, 실제 헬퍼 호출, 로컬 sqlite — `db push` 후 `npx tsx`로 실행).

**UI/게이팅 [§9-6·F]**
- `components/BranchManagerAdmin.jsx` (코어 클라이언트, 목록·지정·범위수정·해제) + `app/(workspace)/work/branch-managers/page.jsx` (래퍼, `branch-admin` 게이팅).
- `lib/brand.js` borough.modules에 `"branch-admin"` 추가, `modules/registry.js`에 nav-only 매니페스트(라벨 "지점 매니저", minRole admin).
- 역할 뱃지: 전 지점+비admin=`supervisor`, 전 지점+admin=`전 지점 매니저(admin)`, 특정지점=지점명.

**정적 검증**: ESM 구문 체크(8파일 OK) · `check-module-boundaries.mjs` ok · 임포트 경로 실재 확인. (node_modules·dev.db 부재로 build/generate/test 실행은 적용 단계에서.)

## 6. 적용 절차 (사인오프 후 — 아직 금지)
1. 스키마 클라이언트 재생성: `npx prisma generate` (+ vercel-build가 `--schema postgres`로 자동).
2. SQLite(dev): `npx prisma db push`. → `npx tsx scripts/test-branch-manager.mjs` 회귀 통과 확인.
3. Postgres(운영): 마이그레이션 **선적용**(`migrate deploy` 또는 SQL 직접) → 검증 → 배포 → health 체크.
4. §9-7 박선영 데이터 정합(운영 SQL 값 기준, 사인오프).

## 7. ✅ 해결됨 — 전 지점 매니저 폼 드롭다운 노출 (사용자 승인 (a)안)
- 원인: 폼이 `allBranchManagers()` 결과를 `manager.branchId === branchId`로 필터(`modules/inventory/ui/DisposalDashboard.jsx:100,339`). 전 지점 행은 `branchId=null` → 누락.
- 조치: `allBranchManagers()`(`lib/inventoryServer.js`)에서 전 지점 매니저를 **활성 지점마다 1행으로 전개**. 모듈 UI(폼) 무수정. 회귀 테스트에 케이스 추가(A=특정+전지점 / B=전지점만).
- 결과: 완료기준 "박선영 모든 지점 reviewer 노출" 충족(검증·승인은 §9-5, 드롭다운 노출은 본 조치).
