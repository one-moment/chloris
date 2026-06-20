# Vercel + Supabase MVP 배포

AWS를 쓰기 전 첫 MVP 배포는 Vercel + Supabase 조합을 권장합니다.

## 1. Supabase 프로젝트 생성

1. Supabase에서 새 프로젝트를 생성합니다.
2. Database password를 저장합니다.
3. Database connection string을 확인합니다.
   - `DATABASE_URL`: Supabase pooler connection string
   - `DIRECT_URL`: direct database connection string

Prisma는 운영 서버리스 환경에서 pooled connection을 쓰고, 스키마 반영 작업은 direct connection을 쓰는 구성이 안정적입니다.

## 2. Supabase Storage 생성

1. Supabase Storage에서 bucket을 생성합니다.
   - 예: `chloris`
2. MVP 확인을 빠르게 하려면 public bucket으로 시작할 수 있습니다.
3. Supabase Storage의 S3 protocol을 활성화하고 access key/secret key를 발급합니다.

환경 변수 예시는 [.env.vercel.example](../.env.vercel.example)을 사용합니다.

중요 값:

```text
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://PROJECT_REF.supabase.co/storage/v1/s3
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=https://PROJECT_REF.supabase.co/storage/v1/object/public/chloris
```

## 3. Vercel 프로젝트 연결

1. Vercel에서 GitHub 저장소 `one-moment/chloris`를 import합니다.
2. Framework는 Next.js로 자동 감지됩니다.
3. Build Command는 저장소의 [vercel.json](../vercel.json)에 의해 `npm run vercel-build`가 사용됩니다.
4. Vercel Environment Variables에 `.env.vercel.example` 값을 실제 값으로 등록합니다.

필수 환경 변수:

```text
DATABASE_URL
DIRECT_URL
ALLOW_PUBLIC_SIGNUP
STORAGE_PROVIDER
S3_BUCKET
S3_REGION
S3_ENDPOINT
S3_FORCE_PATH_STYLE
S3_PUBLIC_BASE_URL
MAX_UPLOAD_BYTES
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

## 4. DB 스키마 반영

첫 배포 전 또는 배포 직후 로컬에서 Supabase DB에 스키마를 반영합니다.

```bash
DATABASE_URL="postgresql://..." \
DIRECT_URL="postgresql://..." \
npm run db:push:postgres
```

## 5. 첫 관리자 계정

운영 URL에 접속해 첫 계정을 생성합니다. 첫 계정은 자동으로 `admin` 역할이 됩니다.

첫 관리자 생성 후에는 Vercel 환경 변수에서 아래 값을 유지합니다.

```text
ALLOW_PUBLIC_SIGNUP=false
```

이후 직원 계정은 관리자 초대 코드로 생성합니다.

## 6. 도메인/HTTPS

Vercel Project Settings에서 도메인을 연결하면 HTTPS 인증서는 Vercel이 자동 발급합니다.

DNS에는 Vercel이 안내하는 `A`, `CNAME` 레코드를 등록합니다.

## 7. 백업

Supabase Dashboard의 백업 정책을 확인합니다. 수동 백업이 필요하면:

```bash
DATABASE_URL="postgresql://..." npm run backup:postgres
```

## 8. 배포 후 점검

- `/api/health` 정상
- 첫 관리자 가입
- 초대 코드 생성
- 초대 코드로 직원 가입
- Messages 작성
- Ideas 작성
- 댓글 작성
- 파일 첨부
- 모바일 화면 확인
