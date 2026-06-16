# 작업 인계 노트 (DELL ↔ 맥북)

> PC를 떠날 때마다 이 파일의 **"현재 상태"와 "마지막 업데이트"를 갱신**하는 것이 인계 마찰을 없애는 핵심 습관입니다.
> 다른 PC에 도착하면 **"세션 시작 체크리스트"**부터 실행하세요.

## 브랜치 규칙
- `main`: 운영 브랜치 — Vercel 자동 배포. **직접 push 금지** (PR로만 머지).
- `develop`: 작업용 브랜치 — push 시 Vercel **preview URL** 자동 생성.
- 흐름: `develop`(또는 `feature/*`)에서 작업 → push → **preview에서 운영과 동일 환경으로 확인** → PR로 `main` 머지 → 운영 배포.

## 환경 기준 (두 PC 일치)
- 패키지 매니저: **npm** (`package-lock.json` 커밋됨 — 두 PC 동일 버전 설치).
- Node: **24** (`.nvmrc` 기준, `engines: ">=24 <25"`). Vercel 기본값과 일치. → 도착 시 `nvm use`.
- 비밀정보: `.env`는 **절대 커밋 금지**(.gitignore). 키 목록은 `.env.example` 참고.
- 줄바꿈: `.gitattributes`로 LF 정규화 (Windows ↔ Mac 충돌 방지).

## ⚠️ 저장소 현황 주의
- 실제 활성 개발은 `feature/purchase-bot-mvp`(현재 `main`보다 **111커밋 앞섬**), `feature/crm-followups`, `feature/crm-phase3`, `design/structural-rail`에 있습니다.
- 이 `develop`는 **`main` 기준**으로 분기한 **개발환경 기반 정비용**입니다. feature 브랜치들은 이후 `main`을 머지해야 이 설정(.gitattributes/.nvmrc 등)을 받습니다.
- Vercel 프로젝트 연결(GitHub 저장소 import, production=main, preview=그 외)은 **Vercel 대시보드에서 1회 설정** 필요(코드로 자동화되지 않음).

## 현재 상태
- 작업 중 브랜치: `develop`
- 진행 중인 내용: 2-PC Git 협업 환경 구성 (.gitignore 보완 · .gitattributes · .nvmrc · engines · HANDOFF.md)
- 다음 할 일: `develop` push → Vercel preview 연결 확인 → PR로 `main` 머지 / import 경로 대소문자 감사 결과 반영
- 주의사항(미완성/결정 대기): Vercel 프로젝트 연결(대시보드) 미설정 · feature 브랜치와 main 관계 정리 필요

## 마지막 업데이트
- 어느 PC에서 / 언제: **DELL(Windows) / 2026-06-16**

---

## 세션 종료 체크리스트 (이 PC를 떠나기 전)
1. 변경 사항을 모두 커밋했는가? (`git status`가 깨끗한가)
2. 작업 브랜치를 origin에 push 했는가?
3. 위 "현재 상태"와 "마지막 업데이트"를 갱신했는가?

## 세션 시작 체크리스트 (다른 PC에 도착해서)
1. `git pull` (작업 브랜치 최신화)
2. Node 버전 확인 (`.nvmrc` 기준 — `nvm use`)
3. 패키지 설치 (`npm install`)
4. `.env`가 이 PC에 있는지 확인 (없으면 `.env.example` 참고해 채우기)
5. `HANDOFF.md`의 "현재 상태" 읽고 이어서 작업
