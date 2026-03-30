# 자동 계획 하네스 — 운영 수동 검증 체크리스트

## 검증 환경 준비
- `npm run dev` 로 로컬 서버 실행 (포트 3030)
- `.env.local` 에 `ANTHROPIC_API_KEY` 설정 확인
- Supabase 연결 확인 (세션 저장 테스트용)

---

## 1. 기본 하네스 실행

실행: 메인 페이지 → 워크플로 "자동 계획" 선택 → 주제 입력 ("React로 투두앱 만들기") → "자동 계획 시작"

기대 결과:
- 진행바에 normalize → cps → generate → lint → evaluate 단계가 실시간으로 나타남
- 각 단계별 attempt 로그가 실시간으로 쌓임
- 최종 completed 이벤트 후 RequirementSpec, CPS, GeneratedPlan, Evaluation 패널이 모두 표시됨
- status가 complete 또는 error로 전환됨

실패 시 확인:
- 브라우저 Network 탭에서 `/api/plan-harness` 응답이 NDJSON인지 확인
- 각 줄이 `{"event":"..."}` 형태인지 확인
- 서버 콘솔에서 `plan-harness error` 로그 확인

## 2. NDJSON 단계 스트리밍 확인

실행: 위 1번과 동일. 브라우저 Network 탭의 `/api/plan-harness` Response를 실시간 관찰.

기대 결과:
- `started` → `stage_started(normalize)` → `attempt(normalize, success)` → `stage_started(cps)` → ... → `completed` 순서
- 각 이벤트에 timestamp가 있음
- attempt 이벤트의 model/provider가 기본값 `claude-opus-4-6` / `anthropic`

실패 시 확인:
- 이벤트 순서가 올바른지 (started가 첫 줄, completed/error가 마지막)
- abort/error 이벤트가 예기치 않게 나오지 않는지

## 3. 취소(aborted) 동작 확인

실행: 하네스 시작 후 2-3초 뒤 "중단" 버튼 클릭.

기대 결과:
- UI가 idle 상태로 돌아감
- Network 탭에서 요청이 cancelled 상태
- 서버 NDJSON에 `aborted` 이벤트가 있음
- completed 이벤트는 없음

실패 시 확인 (배포 blocker):
- aborted 후 completed 이벤트가 추가로 옴 → 서버 취소 전파 실패
- UI가 generating_plan에 멈춤 → client abort 처리 버그

## 4. PRD 생성

실행: 하네스 완료 후 "산출물 생성" 영역의 "PRD 생성" 버튼 클릭.

기대 결과:
- generating_prd 상태로 전환
- PRD가 스트리밍으로 렌더링됨
- 완료 후 FinalPlan 패널에 PRD가 표시됨
- "PRD 생성" 버튼이 사라지고 명령/UI 생성 버튼의 "(계획 기반)" 표시가 사라짐

실패 시 확인:
- `/api/synthesize` 요청에 `source: "harness"`, `harnessArtifacts` 가 포함되는지 Network 탭 확인
- 서버 콘솔에서 synthesize 에러 로그 확인

## 5. 하네스 PRD 피드백 리파인

실행: PRD 생성 후 피드백 입력란에 "기술 스택을 Next.js로 변경해주세요" 입력 → "피드백 반영" 클릭.

기대 결과:
- generating_prd 상태로 전환 (debating이 아님)
- PRD가 재생성되면서 피드백이 반영됨
- revisionCount가 증가. 버전 탭에서 이전 버전 확인 가능
- 안내 문구가 "하네스 산출물 기반으로 PRD를 수정합니다"

실패 시 확인 (배포 blocker):
- debating 상태로 전환되며 토론 재실행이 발생 → submitFeedbackAndRefine 분기 오류
- `/api/synthesize` 요청에 `source: "harness"`, `mode: "refine"` 확인

## 6. 구조 수정 요청 + 재실행

실행: 하네스 완료 후 "계획 구조 수정" → "수정 요청 + 재실행" → "인증 모듈을 분리해주세요" 입력 → "수정 요청 반영하여 재실행".

기대 결과:
- 이전 PRD/명령/UI가 초기화됨
- 새 하네스 실행이 시작됨 (NDJSON 스트리밍)
- 새 결과에 수정 요청이 반영됨 (RequirementSpec.constraints에 인증 분리 관련 내용)
- harnessRunCount가 증가

실패 시 확인:
- `/api/plan-harness` 요청에 `revisionRequest`, `previousPlanSummary` 확인
- 이전 결과가 history에 보관됐는지 확인

## 7. 이전 실행과 diff 비교

실행: 재실행 완료 후 diff 패널 확인.

기대 결과:
- "실행 #N vs #N-1 비교" 패널이 표시됨
- 마일스톤 추가/삭제, 태스크 수 변화, 점수 변화가 표시됨
- 직전 수정 요청이 표시됨

실패 시 확인:
- state.harness.history 에 이전 스냅샷이 있는지 (브라우저 React DevTools)
- history[0].generatedPlan 이 null이 아닌지

## 8. 세션 저장/복원

실행: 하네스 완료 후 페이지 새로고침 → 세션 목록에서 해당 세션 클릭.

기대 결과:
- harness 결과 (RequirementSpec, CPS, Plan, Evaluation) 복원
- history 복원
- PRD/명령/UI (생성했다면) 복원
- activeWorkflow가 plan_harness로 복원

실패 시 확인 (배포 blocker):
- Supabase에서 해당 row의 harness_data / active_workflow 컬럼 확인
- 컬럼이 없으면 recommendation._harness 로 legacy 복원 확인
- 서버 콘솔에 `[session-store] dedicated harness columns not found` 경고 여부

## 9. 모델 설정 metadata 확인

실행: 하네스 완료 후 PlanEvaluationPanel의 "실행 이력" 확인.

기대 결과:
- 각 attempt에 모델명이 괄호로 표시됨 (예: `(claude-opus-4-6)`)
- normalize/cps/generate → generation model
- evaluate → evaluation model
- 현재 기본값에서는 모두 `claude-opus-4-6`

---

## 보안/운영 배포 Blocker 기준

아래 중 하나라도 해당하면 배포하지 마라. 기능이 완벽해도 이 항목을 통과하지 못하면 배포 불가.

### 인증/권한
7. 인증 없이 데이터 CRUD가 가능한 API 엔드포인트 존재 (GET /api/sessions, DELETE /api/sessions/[id], GET /api/search)
8. SERVICE_ROLE_KEY를 사용하는 API가 인증 없이 공개되어 있음

### 에러 노출
9. API 에러 응답에 error.message가 그대로 클라이언트에 전달됨 (내부 스택트레이스, DB 에러, API 키 관련 정보 유출 가능)

### 환경변수
10. 필수 환경변수(ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) 누락 시 앱이 시작되지만 런타임에 알 수 없는 에러 발생

### 입력 검증
11. API route에서 요청 본문을 Zod 등으로 검증하지 않고 그대로 사용 (악의적 입력으로 예기치 않은 동작 유발 가능)

### 배포 환경 보호
12. Vercel Deployment Protection 또는 동등한 접근 제어가 활성화되지 않은 상태에서 공개 배포

---

## 기능 배포 Blocker 기준

아래 중 하나라도 발생하면 배포하지 마라. (기능 정합성 기준)

1. completed 이벤트 없이 generating_plan에 영구 정지
2. aborted 후 completed 이벤트가 추가로 발생
3. 재실행 후 이전 결과와 새 결과가 구분 안 됨 (history 유실)
4. 세션 새로고침 후 harness 결과 완전 유실
5. 하네스 PRD 피드백이 기존 토론 재실행 경로를 타는 경우
6. extractJson이 코드펜스/산문을 통과시키는 경우 (엄격 파서 우회)

## Known Limitations (배포 허용)

- Anthropic SDK 호출 중 완전 강제 취소 불가 (현재 호출 완료 대기 후 다음 단계 차단)
- UI에서 모델 선택기 없음 (API 직접 호출로만 변경)
- 최근 1개 실행만 diff 비교 가능 (history 3개까지 저장되지만 UI는 직전만 비교)
- Supabase harness_data 컬럼 미적용 시 recommendation JSONB fallback 사용
- Vercel Free 플랜 10초 타임아웃으로 하네스 동작 불가 (Pro 필요)

---

## 디버그 포인트

### UI에서 확인 가능
- PlanEvaluationPanel의 "실행 이력": attempt별 stage, model, 성공/실패, 에러 메시지
- HarnessDiffPanel: 직전 실행과의 구조 변화 요약
- 진행바: 현재 활성 단계 (stage_started 이벤트 기반)
- 스트리밍 라벨: "요구사항 정규화 중...", "CPS 분석 중..." 등
- 에러 카드: state.error 내용

### 코드/브라우저에서 확인
- React DevTools → state.harness: 전체 하네스 산출물
- state.currentHarnessStage: 현재 진행 단계 (스트리밍 중)
- state.harnessRunCount: 몇 번째 실행인지
- state.harnessRevisionRequest: 마지막 구조 수정 요청
- state.harnessUserSummary: 서버가 보낸 완료 요약

### DB에서 확인
- debates.harness_data: 전용 컬럼 (마이그레이션 적용 시)
- debates.active_workflow: "plan_harness" 또는 "standard"
- debates.recommendation._harness: legacy fallback (전용 컬럼 없을 때)
- debates.recommendation._activeWorkflow: legacy fallback

### 서버 로그에서 확인
- `[session-store] dedicated harness columns not found`: legacy fallback 발동
- `plan-harness error`: 하네스 실행 중 예외
- `Synthesize API error`: PRD 생성 중 예외
