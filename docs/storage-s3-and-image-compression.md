# 저장소: S3 전환 + 이미지 압축

작성: 2026-06-14. 코어 기능(3사 공통). 코드: `lib/storage.js`, `lib/imageCompress.js`.

## 1. 이미지 압축 (코드 — 완료)

- 업로드 직전 **브라우저에서** 이미지 리사이즈+재인코딩(`lib/imageCompress.js`, `WorkspaceShell.filesToAttachments`에서 호출).
- 규칙: 이미지만, 긴 변 최대 **2000px**, JPEG 품질 **0.82**, ~300KB 이하·GIF·SVG는 건너뜀, 압축이 더 크면 원본 유지.
- 폴백: HEIC 등 브라우저가 못 여는 형식은 **원본 업로드**(업로드를 막지 않음). EXIF 회전은 `createImageBitmap({imageOrientation:"from-image"})`로 보정.
- 효과: inline·S3 양쪽에서 동작 → 모바일 업로드 속도↑, egress/저장↓, **inline 1.5MB 캡도 사진은 대부분 통과**.
- 동작/모듈 경계 변경 없음. 문서·계약 등 비이미지 파일은 그대로.

## 2. 보로 S3 전환 (콘솔 작업 — 리더/운영)

코드는 이미 S3 지원. 아래 env만 보로 Vercel 프로젝트에 설정하면 **새 업로드부터 S3**로 가고, 기존 inline 첨부는 그대로 동작합니다.

### Supabase Storage 준비
1. 보로 Supabase 프로젝트 → Storage → **버킷 생성**(예: `boro-uploads`). 공개 읽기로 쓸 경우 **public 버킷**.
2. Storage용 **S3 액세스 키/시크릿** 발급(Project Settings → Storage/S3).

### Vercel(보로 프로젝트) 환경변수
`.env.vercel.example` 참고:
```
STORAGE_PROVIDER=s3
S3_BUCKET=boro-uploads
S3_REGION=ap-northeast-2
S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/boro-uploads
MAX_UPLOAD_BYTES=10485760   # 10MB 하드캡
AWS_ACCESS_KEY_ID=<supabase storage key>
AWS_SECRET_ACCESS_KEY=<supabase storage secret>
```
> 비밀키는 코드/문서에 적지 말고 Vercel 환경변수에만. 회사별 버킷·키 분리(파일도 회사 간 격리).

### 적용 후 확인
- 재배포(또는 env 저장 후 redeploy) → 첨부 시 `/api/uploads/presign`이 `provider:"s3"` 반환 → 브라우저가 S3로 직접 PUT.
- 사진 1장 올려 공개 URL 200 확인, 게시글/메시지에 표시 확인.

## 3. 다음 후보(선택)
- 게시판 그리드용 썸네일 변형 생성(원본은 클릭 시) — egress 추가 절감, 변형본 저장 필요.
- WebP 출력(브라우저 지원 감지 시) — JPEG 대비 추가 절감.
