# Harness Model Configuration

## 기본값

generation은 `{ provider: "anthropic", model: "claude-sonnet-4-6" }`,
evaluation은 `{ provider: "anthropic", model: "claude-opus-4-8" }`.

## 변경 방법

### 서버 기본값
`src/lib/model-registry.ts`의 `DEFAULT_HARNESS_GENERATION`과 `DEFAULT_HARNESS_EVALUATION` 상수를 수정.

### API 요청 레벨
`POST /api/plan-harness` body에 `models` 필드 추가:
```json
{
  "topic": "...",
  "command": "debate",
  "models": {
    "generation": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
    "evaluation": { "provider": "anthropic", "model": "claude-opus-4-8" }
  }
}
```
생략 시 기본값 사용.

## 지원 모델 레지스트리

`src/lib/model-registry.ts`에서 provider/model 조합을 중앙 관리.

| provider | model | 용도 |
| --- | --- | --- |
| anthropic | `claude-sonnet-4-6` | 기본 generation |
| anthropic | `claude-opus-4-8` | 기본 evaluation / 고품질 PRD |
| openai | `gpt-5.5` | 외부 evaluator |
| openai | `gpt-5.5-pro` | 하이엔드 외부 evaluator, 비스트리밍/백그라운드 |
| google | `gemini-3-pro-preview` | 외부 evaluator / UI prototype |

## 메타데이터 확인

PlanAttempt의 `model`과 `provider` 필드에 실제 사용 모델이 기록됨.
- normalize/cps/generate/lint/repair → generation model
- evaluate → evaluation model

세션 저장 후 `harness.attempts`를 보면 각 단계에서 어떤 모델이 쓰였는지 확인 가능.

## A/B 테스트 시나리오

1. generation을 Sonnet, evaluation을 Opus로 설정하여 비용 절감 효과 측정
2. 동일 입력으로 Opus vs Sonnet generation 비교 (evaluation은 고정)
3. 외부 evaluator (GPT, Gemini) 도입 시 evaluation 설정만 변경

## 현재 제한

- UI에서 하네스 모델 선택기는 아직 없음. API 직접 호출로만 변경 가능.
- `models.generation` / `models.evaluation`은 `src/lib/model-registry.ts`에 등록된 provider/model 조합만 허용.
- Claude/OpenAI/Gemini structured 호출은 `callStructuredModel`에서 provider별로 분기.
- `gpt-5.5-pro`는 스트리밍 미지원 모델이므로 하네스 structured 호출에서만 백그라운드 폴링으로 사용.
