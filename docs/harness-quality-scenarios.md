# Harness Quality Scenarios

품질 점검에 사용된 시나리오와 발견된 문제, 조정 내용을 기록합니다.

## 시나리오 A: 모호한 요청 — "챗봇 만들어줘"

문제점:
- normalize가 constraints를 빈 배열로 반환할 위험. 모호한 입력에서도 일반적 제약(예산, 기간, 플랫폼)을 유도해야 함.
- missingInfo가 1-2개로 부족. 타겟 플랫폼, 인증 방식, 데이터 저장 등 핵심 결정사항이 빠짐.
- CPS의 problem이 "소프트웨어를 만들어야 한다" 수준의 일반론이 될 위험.
- generate에서 ownerHint가 전부 "fullstack"으로 통일될 위험.

조정:
- normalize: constraints 최소 2개, nonGoals 최소 2개, 모호한 입력이면 missingInfo 3개 이상 지침 추가.
- cps: "일반론 금지" 명시. context/problem에 프로젝트 고유 배경을 반영하게 유도.
- generate: ownerHint 단일값 금지 지침 추가.
- linter: SINGLE_OWNER_HINT 경고 규칙 추가 (task 3개 이상이면서 모두 같은 owner).

## 시나리오 B: 현실적 제약 — "React + Supabase로 2주 내 모바일 반응형 투두앱, 오프라인 지원 필요"

문제점:
- "2주"라는 시간 제약이 milestone에 반영되지 않을 위험 (기간별 분할 없이 기능별 분할만).
- "오프라인 지원"이 constraints에는 있지만 task로 구체화되지 않을 위험.
- evaluator가 시간 제약 대비 task 양의 비현실성을 감점하지 않을 위험.
- 린터의 요구사항 미반영 검출이 50% 이상이어야만 error → 1개 빠져도 중요한 제약은 잡지 못함.

조정:
- generate: "시간 제약이 있으면 기간별 milestone" 지침 추가.
- generate: "constraints의 각 항목이 최소 1개 task에 반영" 지침 추가.
- linter: CONSTRAINT_NOT_REFLECTED warning 추가 (개별 미반영 제약당 경고).
- evaluator: feasibility에 "시간 제약 대비 task 양" 감점 지침 추가.
- evaluator: score 산출 가중치를 명시 (requirementCoverage 30%, feasibility 20% 등).

## 시나리오 C: 구조적 수정 재실행 — "결제는 제외하고 MVP를 1주 안에 가능한 범위로 축소"

문제점:
- revisionRequest가 normalize에만 들어가므로, "결제 제외"가 nonGoals로는 추가되지만 generate에서 여전히 결제 관련 task가 남을 수 있음.
- evaluator가 nonGoals 위반을 hallucinationRisk로 잡지 않을 수 있음.

조정:
- generate: "nonGoals에 해당하는 작업은 포함하지 마라" 명시 지침 추가.
- evaluator: "nonGoals에 해당하는 작업이 plan에 있으면 hallucinationRisk +20" 지침 추가.
- normalize: revisionRequest + previousPlanSummary 조합으로 맥락 제공 (이전 패스에서 구현 완료).
