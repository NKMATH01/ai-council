# AI Council v2 확장 기능 Plan

> **목적**: Claude Code/Codex CLI 개발 보완 도구로서, 기존 토론 기능에 의견 청취/추가 개발/구조 수정 모드를 추가하고, AI 엔진 선택/기술 스펙 입력/명령 변환/UI 프로토타입 생성 기능을 통합한다.

---

## 1. 현재 시스템 분석

### 1.1 현재 구조

```
src/
├── app/
│   ├── page.tsx              # 메인 (DebateArena)
│   ├── layout.tsx             # 글로벌 레이아웃
│   ├── globals.css            # 디자인 토큰
│   ├── sessions/              # 세션 목록/상세
│   └── api/
│       ├── debate/route.ts    # 토론 스트리밍 (Claude Sonnet)
│       ├── recommend/route.ts # 역할 추천 (Claude Sonnet)
│       ├── synthesize/route.ts# PRD 생성 (Claude Opus)
│       ├── verify/route.ts    # 검증 (GPT/Gemini)
│       └── sessions/          # 세션 CRUD
├── components/
│   ├── DebateArena.tsx        # 메인 컨트롤러 UI
│   ├── TopicInput.tsx         # 입력 폼 (현재: 텍스트+명령어)
│   ├── StatusCards.tsx        # 상태 카드
│   ├── RecommendationPanel.tsx# 역할 추천 패널
│   ├── RoundDisplay.tsx       # 토론 라운드 표시
│   ├── VerificationPanel.tsx  # 검증 선택
│   ├── FinalPlan.tsx          # PRD 표시+피드백
│   ├── FeedbackEntry.tsx      # 피드백 기록
│   ├── AiMessage.tsx          # AI 메시지 버블
│   ├── SessionList.tsx        # 세션 목록
│   └── SessionDetailClient.tsx# 세션 상세
├── hooks/
│   └── useDebate.ts           # 토론 상태 관리 (핵심 로직)
└── lib/
    ├── types.ts               # 타입 정의
    ├── constants.ts           # 역할 풀, 모델 설정
    ├── prompts.ts             # 프롬프트 시스템
    ├── ai-stream.ts           # AI 스트리밍 (Claude/GPT/Gemini)
    ├── ai-clients.ts          # AI 클라이언트 초기화
    └── session-store.ts       # 파일 기반 세션 저장
```

### 1.2 현재 플로우

```
사용자 입력 → 명령어 파싱 (/quick, /deep, /debate)
  ├─ /quick: 3인(설계자+비판자+중재자) → PRD 직행
  ├─ /deep:  7인 전체 → GPT+Gemini 2라운드 검증 → PRD
  └─ /debate: AI 추천 → 역할 확인 → 토론 → 검증 선택 → PRD
```

### 1.3 현재 제약

- **DebateCommand** 타입: `"quick" | "deep" | "debate"` — 3개만 존재
- **토론 엔진 고정**: Claude Sonnet 4.6 only
- **PRD 엔진 고정**: Claude Opus 4.6 only
- **입력 폼**: 단순 텍스트 한 개 (주제만)
- **출력**: PRD만 생성, Claude Code 명령 변환 없음
- **UI 프로토타입**: 없음

---

## 2. 추가 기능 상세

### 기능 1: 세 가지 모드 추가

#### 2.1.1 /consult (의견 청취 모드)

**목적**: 이미 개발된 코드에 대해 전문가 의견을 수집

**입력 양식**:
| 필드 | 설명 | 필수 |
|------|------|------|
| 프로젝트명 | 프로젝트 이름 | O |
| 현재 개발 상황 | 간단 설명 | O |
| 기술 스택 | 사용 중인 기술 | O |
| 코드 또는 구조 | 붙여넣기/설명 | O |
| 궁금한 점 | 구체적 질문 | O |

**전문가 출력 초점**: 코드 리팩토링, 성능 개선, 보안 취약점, 더 나은 패턴

**플로우**:
```
양식 입력 → 역할 추천/선택 → 전문가 순서 의견 → 검증(선택) → PRD 대신 "의견 종합 보고서" 생성
```

#### 2.1.2 /extend (추가 개발 모드)

**목적**: 기존 프로그램에 새 기능 추가 설계

**입력 양식**:
| 필드 | 설명 | 필수 |
|------|------|------|
| 프로젝트명 | 프로젝트 이름 | O |
| 현재 기능 | 이미 되는 것들 | O |
| 기술 스택 | 사용 중인 기술 | O |
| 추가하고 싶은 기능 | 설명 | O |
| 제약 조건 | 비용, 라이브러리 등 | X |

**전문가 출력 초점**: 기존 코드 영향 최소화, 새 기능 통합 방법

**중재자 필수 출력**: "수정할 파일 목록" + "새로 만들 파일 목록" 구분 정리

**플로우**:
```
양식 입력 → 역할 추천/선택 → 토론 → 검증(선택) → "확장 계획서" 생성
```

#### 2.1.3 /fix (구조 수정 AS 모드)

**목적**: 구조 문제/반복 에러/유지보수 난이도 해결

**입력 양식**:
| 필드 | 설명 | 필수 |
|------|------|------|
| 프로젝트명 | 프로젝트 이름 | O |
| 문제 상황 | 안 되는 것/불편한 것 | O |
| 현재 코드/구조 | 붙여넣기/설명 | O |
| 기술 스택 | 사용 중인 기술 | O |
| 이전 시도한 해결법 | 있으면 | X |

**발언 순서 특수 규칙**: 비판자 → 설계자 → 나머지 → 중재자

**중재자 필수 출력**: "수정 전 코드" vs "수정 후 코드" 대비 + Claude Code/Codex 수정 명령문

**플로우**:
```
양식 입력 → 비판자 우선 분석 → 설계자 구조 제안 → 나머지 의견 → 중재자 종합 → "수정 계획서" 생성
```

### 기능 2: 토론 엔진 AI 선택

**토론 엔진 옵션**:
| ID | 라벨 | 설명 |
|----|------|------|
| `claude-sonnet` | Claude Sonnet 4.6 | 기본, 가성비 최고 |
| `claude-opus` | Claude Opus 4.6 | 복잡한 설계, 최고 품질 |
| `gpt` | GPT-5.4 | 다른 관점, 실행력 강점 |
| `gemini` | Gemini 3.1 Pro | 가성비 + 추론 강점 |

**검증 AI 옵션**:
| ID | 라벨 | 조건 |
|----|------|------|
| `gpt` | GPT-5.4 | 추천 |
| `gemini` | Gemini 3.1 Pro | - |
| `claude-opus` | Claude Opus 4.6 | 토론 엔진이 Sonnet일 때만 |
| `none` | 검증 안 함 | - |

**충돌 방지**: 토론 엔진 == 검증 AI → 경고 메시지 표시

**영향 범위**:
- `ai-stream.ts`: 토론 스트리밍을 선택된 AI로 분기
- `constants.ts`: 엔진 옵션 상수 추가
- `types.ts`: `DebateEngineId` 타입 추가
- `useDebate.ts`: 엔진 선택 상태 관리
- `api/debate/route.ts`: 요청 body에 엔진 ID 포함, 분기 처리

### 기능 3: 기술 스펙 문서 입력

**위치**: 모든 모드의 입력 양식 하단에 "기술 스펙 문서 (선택사항)" 텍스트 영역 추가

**동작**:
- 문서가 있으면 프롬프트에 규칙 추가: "제공된 기술 스펙 문서를 반드시 참고하여 답변하세요. 문서에 명시된 기술 스택과 구조를 존중하세요."
- API 요청에 `techSpec` 필드 추가
- 프롬프트 시스템에서 techSpec이 있으면 COMMON_RULES에 해당 규칙 주입

### 기능 4: Claude Code/Codex 명령 변환

**위치**: 모든 모드의 최종 결과(PRD/보고서) 아래

**동작**:
- "Claude Code 명령 생성" 버튼 클릭
- AI가 토론 결과를 분석하여 Claude Code에 바로 붙여넣을 수 있는 명령문 생성
- 모드별 명령문 포맷 차별화 (consult/extend/fix/debate)
- 복사 버튼 포함

**구현**: 새 API 라우트 `/api/generate-command` — Claude Sonnet으로 명령문 생성

### 기능 5: UI 프로토타입 자동 생성 (Gemini 전담)

**타이밍**: 모든 모드의 PRD/계획서 완성 후 자동 실행 (건너뛰기 옵션)

**Gemini 프롬프트**:
```
아래 PRD를 기반으로 실제 작동하는 HTML 프로토타입을 만들어줘.
단일 HTML 파일로 만들고, CSS와 JavaScript를 모두 포함해.
한국어로 모든 텍스트를 작성해.
반드시 포함할 것: 메인 화면 레이아웃, 주요 기능 버튼 (실제 클릭하면 화면 전환되게),
네비게이션 메뉴, 기본 폼 입력 화면, 반응형 디자인, 깔끔하고 현대적인 UI 디자인.
각 버튼과 메뉴는 실제 동작하는 것처럼 화면이 전환되어야 해.
데이터는 더미 데이터로 채워. 색상은 전문적이고 깔끔한 톤으로.

[PRD 전문 첨부]
```

**UI 구성**:
- "미리보기" 버튼 → iframe으로 HTML 렌더링
- "HTML 코드 복사" 버튼
- "UI 수정 요청" 버튼 → 입력창 → Gemini에 기존 HTML + 수정 요청 전송 → 반복 가능
- "확정" 버튼 → HTML 확정 + Claude Code 명령문 생성

**구현**: 새 API 라우트 `/api/generate-ui` — Gemini 전용

---

## 3. 구현 계획

### Phase 1: 타입/상수/프롬프트 확장 (기반 작업)

**수정 파일**:

| 파일 | 변경 내용 |
|------|----------|
| `types.ts` | `DebateCommand` 확장 (`"consult" \| "extend" \| "fix"` 추가), `DebateEngineId` 타입, `ConsultInput`/`ExtendInput`/`FixInput` 인터페이스, `DebateState`에 `debateEngine`/`verifyEngine`/`techSpec`/`modeInput`/`generatedCommand`/`prototypeHtml` 필드 추가 |
| `constants.ts` | `DEBATE_ENGINES` 상수, `VERIFY_OPTIONS` 확장, 모드별 기본 역할 (CONSULT_ROLES, FIX_ROLES 등) |
| `prompts.ts` | `getConsultRolePrompt()`, `getExtendRolePrompt()`, `getFixRolePrompt()` 추가, `getModeratorPrompt()` 모드별 분기, `getCommandGenerationPrompt()` 추가, `getUiPrototypePrompt()` 추가, techSpec 주입 로직 |

### Phase 2: AI 스트리밍 엔진 선택 인프라

**수정 파일**:

| 파일 | 변경 내용 |
|------|----------|
| `ai-stream.ts` | `streamDebate(engine, system, user)` 함수 — 엔진 ID에 따라 Claude/GPT/Gemini 분기, GPT/Gemini 스트리밍을 토론에도 사용 가능하게 확장 |
| `api/debate/route.ts` | `debateEngine` 파라미터 받아서 분기 |
| `api/synthesize/route.ts` | PRD 엔진도 선택 가능하게 (기본은 Opus 유지) |

### Phase 3: 입력 UI 재설계

**수정/생성 파일**:

| 파일 | 변경 내용 |
|------|----------|
| `TopicInput.tsx` | 완전 재작성 → 모드 선택 탭 UI + 모드별 구조화된 입력 양식 + AI 엔진 선택 드롭다운 + 기술 스펙 입력 영역 |
| `DebateArena.tsx` | `handleSubmit`에 새 모드/엔진/techSpec 파라미터 전달 |

### Phase 4: useDebate 훅 확장

**수정 파일**:

| 파일 | 변경 내용 |
|------|----------|
| `useDebate.ts` | `startConsult()`, `startExtend()`, `startFix()` 추가, `debateEngine`/`verifyEngine` 상태 관리, `generateCommand()` 액션, `generatePrototype()`/`refinePrototype()` 액션, `fetchStream()`에 엔진 분기 전달, `runStage()`에 모드별 프롬프트 분기 |

### Phase 5: 새 API 라우트

**생성 파일**:

| 파일 | 역할 |
|------|------|
| `api/generate-command/route.ts` | 토론 결과 → Claude Code 명령문 변환 (Claude Sonnet) |
| `api/generate-ui/route.ts` | PRD → HTML 프로토타입 생성 (Gemini 전담) |

### Phase 6: 결과 UI 컴포넌트

**수정/생성 파일**:

| 파일 | 변경 내용 |
|------|----------|
| `FinalPlan.tsx` | 모드별 제목 변경 (PRD/의견 종합/확장 계획/수정 계획), "Claude Code 명령 생성" 버튼 추가 |
| `components/CommandOutput.tsx` | **새 파일** — 생성된 명령문 표시 + 복사 버튼 |
| `components/UiPrototype.tsx` | **새 파일** — HTML 프로토타입 미리보기(iframe) + 코드 복사 + 수정 요청 + 확정 |

### Phase 7: 세션/저장 확장

**수정 파일**:

| 파일 | 변경 내용 |
|------|----------|
| `types.ts` (Session) | `debateEngine`, `modeInput`, `generatedCommand`, `prototypeHtml` 필드 추가 |
| `session-store.ts` | 프로토타입 HTML 별도 파일 저장 |
| `SessionDetailClient.tsx` | 모드별 표시 분기, 명령문/프로토타입 표시 |
| `sessions/page.tsx` | 새 모드 라벨 표시 |

---

## 4. 파일 변경 요약

### 수정 파일 (13개)
1. `src/lib/types.ts`
2. `src/lib/constants.ts`
3. `src/lib/prompts.ts`
4. `src/lib/ai-stream.ts`
5. `src/hooks/useDebate.ts`
6. `src/components/TopicInput.tsx`
7. `src/components/DebateArena.tsx`
8. `src/components/FinalPlan.tsx`
9. `src/components/StatusCards.tsx`
10. `src/components/SessionDetailClient.tsx`
11. `src/app/sessions/page.tsx`
12. `src/app/api/debate/route.ts`
13. `src/app/api/synthesize/route.ts`

### 신규 파일 (4개)
1. `src/app/api/generate-command/route.ts`
2. `src/app/api/generate-ui/route.ts`
3. `src/components/CommandOutput.tsx`
4. `src/components/UiPrototype.tsx`

---

## 5. 구현 순서 (의존성 기반)

```
Phase 1 (타입/상수/프롬프트)
  ↓ 모든 후속 작업의 기반
Phase 2 (AI 엔진 선택 인프라)
  ↓ API 라우트가 엔진 분기 가능해야 함
Phase 3 (입력 UI 재설계)
  ↓ 사용자 입력을 받아야 함
Phase 4 (useDebate 훅 확장)
  ↓ 상태 관리가 되어야 UI가 동작
Phase 5 (새 API 라우트)
  ↓ 명령 생성/UI 생성 API 필요
Phase 6 (결과 UI 컴포넌트)
  ↓ 결과를 표시해야 함
Phase 7 (세션/저장 확장)
  → 최종 데이터 영속화
```

---

## 6. 리스크 및 고려사항

| 리스크 | 대응 |
|--------|------|
| Gemini HTML 출력이 잘릴 수 있음 | maxOutputTokens를 65536으로 설정, 응답 불완전 시 이어쓰기 로직 |
| 토론 엔진 GPT/Gemini 사용 시 프롬프트 호환성 | 각 AI별 프롬프트 튜닝 필요 (시스템 프롬프트 지원 방식 차이) |
| 입력 양식이 복잡해지면 UX 저하 | 모드 탭으로 깔끔하게 분리, 선택사항은 접기/펼치기 |
| 세션 데이터 크기 증가 (HTML 포함) | HTML은 별도 파일로 저장, 세션 JSON에는 경로만 |
| 토론 엔진과 검증 AI 같은 경우 | 선택 시 경고 표시, 강제 차단은 안 함 |

---

## 7. 환경 변수

현재:
- `ANTHROPIC_API_KEY` — Claude
- `OPENAI_API_KEY` — GPT
- `GEMINI_API_KEY` — Gemini

추가 불필요 (기존 키로 모든 기능 커버)

---

## 8. 메인 화면 모드 요약 (UI 표시)

| 명령어 | 설명 | 카테고리 |
|--------|------|----------|
| `/debate` | 새 프로젝트 설계 토론 | 설계 |
| `/quick` | 빠른 3인 토론 | 설계 |
| `/deep` | 깊은 7인 토론 + 외부 검증 | 설계 |
| `/consult` | 기존 코드 전문가 의견 청취 | 보완 |
| `/extend` | 기존 프로그램 기능 추가 설계 | 보완 |
| `/fix` | 구조 수정 AS 모드 | 보완 |
