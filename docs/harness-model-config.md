# Harness Model Configuration

## 기본값

generation과 evaluation 모두 `{ provider: "anthropic", model: "claude-opus-4-6" }`.

## 변경 방법

### 서버 기본값
`src/lib/plan-harness.ts`의 `DEFAULT_GENERATION`과 `DEFAULT_EVALUATION` 상수를 수정.

### API 요청 레벨
`POST /api/plan-harness` body에 `models` 필드 추가:
```json
{
  "topic": "...",
  "command": "debate",
  "models": {
    "generation": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
    "evaluation": { "provider": "anthropic", "model": "claude-opus-4-6" }
  }
}
```
생략 시 기본값 사용.

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

- UI에서 모델 선택기는 아직 없음. API 직접 호출로만 변경 가능.
- Claude 외 provider(OpenAI, Google)를 사용하려면 ai-stream에 해당 structured call 함수 추가 필요.
- callClaudeStructured는 modelId를 받지만 provider 분기는 아직 없음.
