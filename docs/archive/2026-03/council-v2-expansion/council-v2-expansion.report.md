# PDCA Completion Report: council-v2-expansion

> **작성일**: 2026-03-28
> **기능명**: AI Council v2 확장 기능
> **PDCA 최종 상태**: Complete (Match Rate 97%)

---

## 1. 개요

### 1.1 목적

Claude Code/Codex CLI 개발 보완 도구로서, 기존 3개 토론 모드(/quick, /deep, /debate)에 의견 청취(/consult), 추가 개발(/extend), 구조 수정(/fix) 모드를 추가하고, AI 엔진 선택, 기술 스펙 입력, Claude Code 명령 변환, UI 프로토타입 자동 생성 기능을 통합한다.

### 1.2 범위

- 5개 핵심 기능 구현 (7 Phase)
- 수정 파일 13개, 신규 파일 4개
- src/ 기준 +2,087줄 / -242줄

---

## 2. Plan 요약

| Phase | 내용 | 주요 파일 |
|-------|------|----------|
| Phase 1 | 타입/상수/프롬프트 확장 | types.ts, constants.ts, prompts.ts |
| Phase 2 | AI 엔진 선택 인프라 | ai-stream.ts, debate/route.ts, synthesize/route.ts |
| Phase 3 | 입력 UI 재설계 | TopicInput.tsx, DebateArena.tsx |
| Phase 4 | useDebate 훅 확장 | useDebate.ts |
| Phase 5 | 새 API 라우트 | generate-command/route.ts, generate-ui/route.ts |
| Phase 6 | 결과 UI 컴포넌트 | FinalPlan.tsx, CommandOutput.tsx, UiPrototype.tsx |
| Phase 7 | 세션/저장 확장 | session-store.ts, SessionDetailClient.tsx |

---

## 3. 구현 결과

### 3.1 기능별 완료 현황

| 기능 | 설명 | Match Rate | 상태 |
|------|------|:----------:|:----:|
| 기능 1 | 3개 모드 추가 (/consult, /extend, /fix) | 100% | 완료 |
| 기능 2 | 토론 엔진 AI 선택 (Claude/GPT/Gemini) | 100% | 완료 |
| 기능 3 | 기술 스펙 문서 입력 | 100% | 완료 |
| 기능 4 | Claude Code 명령 변환 | 100% | 완료 |
| 기능 5 | UI 프로토타입 자동 생성 (Gemini) | 93% | 완료 (일부 보류) |

### 3.2 Phase별 완료 현황

| Phase | Match Rate | 비고 |
|-------|:----------:|------|
| Phase 1 | 94% | 타입/상수/프롬프트 모두 구현 |
| Phase 2 | 88% | PRD 엔진 선택 보류 (Opus 고정이 품질 최적) |
| Phase 3 | 100% | 모드 탭 UI + 구조화 입력 양식 |
| Phase 4 | 100% | 상태 관리, 엔진 분기, 모드별 프롬프트 |
| Phase 5 | 100% | /api/generate-command, /api/generate-ui |
| Phase 6 | 94% | 프로토타입 자동 실행 보류 (수동이 UX에 유리) |
| Phase 7 | 92% | HTML 별도 파일 저장 보류 (인라인 저장으로 기능 정상) |

---

## 4. Gap Analysis 결과

### 4.1 전체 Match Rate: 97% (Iteration 1 후)

- 초기 분석: 95% (Gap 5건)
- Iteration 1 후: 97% (Gap 2건 해결, 3건 의도적 보류)

### 4.2 해결된 Gap (2건)

| Gap | 내용 | 수정 파일 |
|-----|------|----------|
| Gap 1 | 세션 상세 페이지 모드 라벨 누락 | sessions/[id]/page.tsx |
| Gap 2 | SessionDetailClient 모드별 렌더링 미흡 | SessionDetailClient.tsx |

### 4.3 의도적 보류 (3건, 배포 비차단)

| Gap | 내용 | 보류 이유 |
|-----|------|----------|
| Gap 3 | HTML 별도 파일 저장 | 인라인 저장으로 기능 정상, 대용량 최적화는 추후 |
| Gap 4 | UI 프로토타입 자동 실행 | 수동 실행이 사용자 제어에 유리 |
| Gap 5 | PRD 엔진 선택 | Opus 고정이 PRD 품질에 최적 |

---

## 5. 배포 전 수동 검증 결과 (2026-03-28)

### 5.1 환경 확인

| 항목 | 결과 |
|------|------|
| .env.local 키 6개 | 모두 존재 (ANTHROPIC, OPENAI, GEMINI, XAI, SUPABASE_URL, SUPABASE_KEY) |
| npm run build | 성공 (Next.js 16.2.0, 15 routes, 0 TypeScript errors) |
| npm run test:harness | 36/36 통과 |
| npm run dev (포트 3030) | 200 응답 확인 |
| Supabase 연결 | 성공 (세션 15개 조회) |

### 5.2 수동 검증 체크리스트

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | 기본 하네스 실행 | 통과 | 6 attempts, lint 0 issues, 92점 평가, completed 이벤트 정상 |
| 2 | NDJSON 단계 스트리밍 | 통과 | started→normalize→cps→generate→lint→evaluate→completed 순서 정확 |
| 3 | 취소(abort) 동작 | 통과 | 클라이언트 절단 시 completed 미발생, unit test 4건 통과 |
| 4 | PRD 생성 (harness) | 통과 | source: "harness" 경로 진입, PRD 마크다운 스트리밍 정상 |
| 5 | 하네스 PRD 피드백 리파인 | 통과 | mode: "refine" + source: "harness"로 토론 재실행 없이 PRD 재생성 |
| 6 | 구조 수정 + 재실행 | 통과 | revisionRequest 반영, nonGoals에 제외 항목 포함, 92점 |
| 7 | diff 비교 | 환경상 미실행 | 클라이언트 React 컴포넌트, unit test 2건(computeHarnessDiff) 통과 |
| 8 | 세션 저장/복원 | 부분 통과 | Supabase 연결/조회 성공, roundtrip unit test 14건 통과 |
| 9 | 모델 metadata | 통과 | 기본: claude-opus-4-6, 분리: generation=sonnet/evaluation=opus 정확 |
| + | 엄격 파서 (extractJson) | 통과 | 코드펜스 응답 거부 후 재시도 성공 |
| + | 모델 분리 테스트 | 통과 | Sonnet generation + Opus evaluation 분기 동작 확인 |

### 5.3 미실행 항목 (환경 제약)

| 항목 | 제약 |
|------|------|
| diff 비교 (항목 7) | HarnessDiffPanel은 클라이언트 React 컴포넌트, 브라우저 렌더링 필요. 핵심 로직은 unit test로 검증됨 |
| 세션 UI 새로고침 (항목 8 일부) | E2E 브라우저 시나리오 수행 불가. session-mappers roundtrip unit test 14건으로 로직 검증됨 |

### 5.4 배포 blocker 점검

docs/harness-ops-checklist.md 기준 6개 blocker 항목 점검 결과:

| Blocker | 점검 방법 | 결과 |
|---------|----------|------|
| completed 없이 generating_plan 영구 정지 | 기본 실행 + 구조 수정 재실행 | 미발생 |
| aborted 후 completed 추가 발생 | curl timeout + unit test 28~31 | 미발생 |
| 재실행 후 history 유실 | unit test 19~20 (harness history roundtrip) | 미발생 |
| 세션 새로고침 후 harness 결과 유실 | unit test 2~3, 8~12, 21~22 | 미발생 |
| 하네스 PRD 피드백이 토론 재실행 경로 진입 | API 실행 (mode: "refine" + source: "harness") | 미발생 |
| extractJson이 코드펜스/산문 통과 | unit test 1 + 실제 CPS 재시도 관찰 | 미발생 |

---

## 6. Known Limitations (배포 허용)

| 항목 | 설명 |
|------|------|
| Anthropic SDK 취소 | 현재 호출 완료 대기 후 다음 단계 차단 (완전 강제 취소 불가) |
| UI 모델 선택기 없음 | API 직접 호출로만 모델 변경 가능 |
| diff 비교 | 최근 1개 실행만 UI에서 비교 가능 (history 3개 저장) |
| Supabase harness_data 미적용 시 | recommendation JSONB fallback 사용 (자동 감지) |
| Vercel Free 플랜 | 10초 타임아웃으로 하네스 동작 불가 (Pro 필요) |

---

## 7. 테스트 커버리지

### 7.1 자동 테스트 (test:harness)

36/36 통과. 주요 영역:

| 영역 | 테스트 수 | 내용 |
|------|:---------:|------|
| extractJson 파서 | 1 | strict JSON 수락, 코드펜스/산문 거부 |
| 세션 매핑 roundtrip | 12 | dedicated/legacy 저장, harness metadata/history 보존 |
| 린터 | 3 | 회귀 감지, ownerHint 단일값, 미반영 constraints |
| 스키마 검증 | 1 | 잘못된 JSON/스키마 거부 |
| 하네스 요약/스냅샷 | 4 | milestone/task 추출, empty 처리, snapshot 생성/제한 |
| diff 계산 | 2 | 변경 감지, 동일 plan 처리 |
| attempt 병합 | 5 | client/server-only, 우선순위, 정렬, empty |
| abort 시나리오 | 4 | 호출 전/중/단계간 abort, 추가 attempt 방지 |
| 하네스 실행 | 4 | evaluate attempt, 모델 기록, 기본값, revision rerun |

### 7.2 수동 API 검증

| 시나리오 | 결과 |
|----------|------|
| 기본 하네스 (모호한 입력) | 성공 (CPS 재시도 1회, 최종 92점) |
| 구조 수정 재실행 (revisionRequest) | 성공 (nonGoals 반영, 92점) |
| 모델 분리 (Sonnet gen + Opus eval) | 성공 (메타데이터 정확) |
| 하네스 PRD 생성 (source: "harness") | 성공 (스트리밍 정상) |
| 하네스 PRD 리파인 (mode: "refine") | 성공 (토론 미재실행) |

---

## 8. PDCA 타임라인

| 날짜 | Phase | 내용 |
|------|-------|------|
| 2026-03-22 | Plan | council-v2-expansion.plan.md 작성 (7 Phase, 5 기능) |
| 2026-03-22~24 | Do | Phase 1~7 구현 완료 (13 수정 + 4 신규 파일) |
| 2026-03-24 | Check | Gap Analysis: 95% (Gap 5건) |
| 2026-03-24 | Act | Iteration 1: 95% → 97% (Gap 2건 해결, 3건 의도적 보류) |
| 2026-03-28 | Verify | 배포 전 수동 검증 (9개 체크리스트 + 모델 분리 테스트) |
| 2026-03-28 | Report | 본 보고서 작성 |

---

## 9. 배포 판정

### 판정: 조건부 가능

### 조건

1. **Vercel Pro 플랜 필수** — 하네스 파이프라인 5단계 LLM 호출 체인 (응답 2~3분). Free 플랜 10초 타임아웃으로 동작 불가.
2. **브라우저 E2E 1회 테스트 권장** — diff 비교(항목 7)와 세션 새로고침 복원(항목 8)은 단위 테스트로 로직 검증됨이나, 실제 브라우저 E2E는 미수행.

### 최종 빌드/테스트

| 항목 | 결과 |
|------|------|
| `npm run build` | 성공 — 0 TypeScript errors, 13/13 static pages, 15 routes |
| `npm run test:harness` | 성공 — 36/36 통과 |

---

## 10. 수정 파일 없음

본 보고서 작성 과정에서 코드 수정은 발생하지 않았습니다. 점검 중 배포 blocker에 해당하는 문제가 발견되지 않았습니다.
