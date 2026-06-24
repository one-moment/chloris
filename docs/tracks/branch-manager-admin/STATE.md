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

## 4. 다음 단계 / 정지점
- ▶ **운영 read-only 쿼리**로 §2 표 채우기 (운영자/자격증명 확보 시). 박선영이 이미 admin이면 §9-7 role 변경 생략.
- ⛔ **§9-2 스키마 변경은 사인오프 대기.** (컬럼 4개 + `branchId` nullable + `onDelete: SetNull`, 듀얼 파일, PG 마이그레이션 `IF NOT EXISTS` 수동 보정)
- ⛔ 운영 배포·마이그레이션 선적용은 **별도 승인 전 금지.**
- 현재 변경: 문서 2개(`PLAN.md`, `STATE.md`)만 추가. 코드/스키마/DB **변경 0.**
