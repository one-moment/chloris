# 회사별 분리 (Multi-company split) 런북

확정: 2026-06-11. 명칭: **"Chloris(사내 Work OS)를 회사별로 브랜딩된 워크스페이스로 제공한다."**

## 구조

```
GitHub 레포 1개 (Chloris 코어)
   ├─→ Vercel 프로젝트 onemoment  → onemoment.chloris.app   (NEXT_PUBLIC_BRAND=onemoment)
   ├─→ Vercel 프로젝트 borough    → borough.chloris.app     (NEXT_PUBLIC_BRAND=borough)
   └─→ Vercel 프로젝트 todaykkot  → todaykkot.chloris.app   (NEXT_PUBLIC_BRAND=todaykkot)
```

- **코드 1벌**, Vercel 프로젝트(=배포) 3개, **회사별 Supabase 프로젝트 분리**(데이터 완전 격리).
- 회사 차이는 빌드가 아니라 환경변수: `NEXT_PUBLIC_BRAND` + 회사별 `DATABASE_URL`/`DIRECT_URL`.

## 회사별로 다른 것

| 항목 | 결정 방식 |
|---|---|
| 워크스페이스 이름 | `lib/brand.js` 의 `ACTIVE_BRAND.workspaceName` |
| 켜는 모듈 | `lib/brand.js` 의 `ACTIVE_BRAND.modules` (registry가 게이팅) |
| 데이터 | Vercel 프로젝트별 `DATABASE_URL`/`DIRECT_URL` (Supabase 분리) |
| 테마(색/로고) | `data-brand` 속성 기준 (현재 보로 테마가 기본; 타사 테마는 디자인 확정 후 추가) |

### 모듈 배분 (lib/brand.js)
- 공용: `purchase`
- 보로플라워마켓 전용: `crm`, `reservations` (원모먼트·오늘꽃은 미사용)
- crm/reservations 모듈이 빌드되면 `modules/registry.js`의 `allModules`에 등록 → brand 게이팅으로 보로에서만 노출.

## 코드 토대 (완료)
- `lib/brand.js` — `NEXT_PUBLIC_BRAND` → 브랜드 설정(이름·모듈). 기본값 `borough`(현 운영이 보로).
- `modules/registry.js` — `isModuleEnabled`로 브랜드별 모듈 필터.
- `app/layout.jsx` — `<html data-brand=...>` + 워크스페이스명 메타.
- `.env.example` — `NEXT_PUBLIC_BRAND` 문서화.

## 인프라 작업 (사용자/운영)

### 보로플라워마켓 (기존 자산 재사용)
현재 운영 중인 기존 보로 Vercel 인스턴스(레거시 도메인 — 아래 프로젝트 리네임 대상)에 이미 보로 데이터(지점 강남1/강남2/잠실, 배포로그 등)가 있으므로 **그대로 보로 프로젝트로 사용**한다.
- Vercel 프로젝트 이름을 `borough`로 정리(선택), env `NEXT_PUBLIC_BRAND=borough`(기본값이라 생략 가능).
- 보로 도메인 연결(예: `borough.chloris.app`).
- 데이터 마이그레이션 불필요(상태 유지).

### 원모먼트 / 오늘꽃 (신규)
회사마다 반복:
1. **Supabase 프로젝트 생성** → `DATABASE_URL`(pooler) + `DIRECT_URL` 확보.
2. **Vercel 프로젝트 생성**, 같은 GitHub 레포 연결.
3. **환경변수 설정**: `NEXT_PUBLIC_BRAND=onemoment`(또는 `todaykkot`), `DATABASE_URL`, `DIRECT_URL`, 그 외 공통(STORAGE/S3 등).
4. **마이그레이션 적용**: 해당 DB로 `prisma migrate deploy --schema prisma/schema.postgres.prisma` (DB URL 정확히 지정 — 다른 회사 DB로 가지 않도록 주의).
5. **시드/도메인**: 회사별 초기 프로젝트/채널/지점, 도메인 연결.

> 안전: 마이그레이션·DB 작업 시 대상 `DATABASE_URL`을 반드시 확인. 회사 간 DB 교차 금지.

## 진행 순서 (합의)
1. (지금) 분리 코드 토대 — 완료.
2. Supabase ×3 + Vercel ×3 + env/도메인 — 운영 작업.
3. 분리 후, 보로 프로젝트에서 보로 기능(템플릿=코어 공용, CRM·예약=보로 전용) 구현.
4. 원모먼트/오늘꽃 테마·모듈은 각 회사 요건 확정 시 추가.
