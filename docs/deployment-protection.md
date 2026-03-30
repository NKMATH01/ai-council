# 배포 보호 가이드

> AI Council v2는 개인 내부 도구입니다. 공개 배포 시 아래 보호 조치를 반드시 적용하세요.

---

## 1. 현재 위험 요소

### 1.1 인증 없는 API 엔드포인트
- `GET /api/sessions` — 전체 세션 목록 조회 가능
- `DELETE /api/sessions/[id]` — 임의 세션 삭제 가능
- `GET /api/search` — 세션 검색 가능
- `POST /api/debate`, `POST /api/synthesize` 등 — AI API 키 대리 사용 가능

### 1.2 SERVICE_ROLE_KEY 노출 구조
- `src/lib/db.ts`에서 SUPABASE_SERVICE_ROLE_KEY로 Supabase에 접근
- 이 키는 RLS(Row Level Security)를 완전히 우회
- 인증 없는 API가 이 키를 대리 사용하는 "공개 privileged proxy" 구조

### 1.3 에러 정보 노출
- API catch 블록에서 error.message를 클라이언트에 반환
- Supabase 내부 에러, 스택트레이스 등 유출 가능

---

## 2. 즉시 적용: Vercel Deployment Protection

개인/내부 도구라면 Vercel의 Deployment Protection이 가장 간단한 1차 방어선입니다.

### 설정 방법
1. Vercel Dashboard → 프로젝트 선택
2. Settings → Deployment Protection
3. "Standard Protection" 활성화
4. 옵션:
   - **Vercel Authentication**: Vercel 계정으로 로그인해야 접근 (추천)
   - **Password Protection**: 공유 비밀번호로 접근 (팀 공유 시)

### 효과
- 모든 페이지와 API에 대해 Vercel 레벨에서 접근 차단
- 코드 변경 없이 즉시 적용
- Preview 배포에도 자동 적용

### 한계
- Vercel 외부 배포에는 적용 불가
- API를 프로그래밍 방식으로 호출하려면 별도 토큰 필요
- 다중 사용자 권한 분리는 불가 (전체 접근 or 차단)

---

## 3. 장기 대응: 실제 인증 시스템

외부 사용자 또는 팀 공유가 필요한 경우 아래 중 하나를 적용합니다.

### 옵션 A: Supabase Auth (추천)
- Supabase에 내장된 인증 시스템
- 이메일/비밀번호, OAuth (Google, GitHub 등) 지원
- RLS 정책과 자연스럽게 연동 (`auth.uid()` 기반)
- 전환 작업: db.ts에서 anon key 사용 + RLS 정책 작성 + 세션 미들웨어

### 옵션 B: Auth.js (NextAuth)
- Next.js 전용 인증 라이브러리
- OAuth 프로바이더 다수 지원
- 세션을 서버 사이드에서 관리
- 전환 작업: middleware.ts에서 세션 검증 + API route 보호

### 옵션 C: Clerk
- 관리형 인증 서비스 (가장 빠른 통합)
- UI 컴포넌트 제공
- 전환 작업: Clerk SDK 설치 + middleware 설정

---

## 4. 체크리스트

배포 전 아래를 확인하세요:

- [ ] Vercel Deployment Protection 활성화 (또는 동등한 접근 제어)
- [ ] API 에러 응답에 내부 정보가 포함되지 않는지 확인
- [ ] 환경변수 6개(ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL) 설정 확인
- [ ] `npm run build` 통과
- [ ] `npm run test:harness` 통과
