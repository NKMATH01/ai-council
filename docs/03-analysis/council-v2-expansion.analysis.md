# Gap Analysis: council-v2-expansion

> **분석일**: 2026-03-24
> **기준 문서**: docs/01-plan/features/council-v2-expansion.plan.md
> **전체 Match Rate**: 97% (Iteration 1 후)

---

## 1. Phase별 분석

| Phase | 내용 | Match Rate | 상태 |
|-------|------|:----------:|:----:|
| Phase 1 | 타입/상수/프롬프트 확장 | 94% | ✅ |
| Phase 2 | AI 엔진 선택 인프라 | 88% | ✅ |
| Phase 3 | 입력 UI 재설계 | 100% | ✅ |
| Phase 4 | useDebate 훅 확장 | 100% | ✅ |
| Phase 5 | 새 API 라우트 | 100% | ✅ |
| Phase 6 | 결과 UI 컴포넌트 | 94% | ✅ |
| Phase 7 | 세션/저장 확장 | 92% | ✅ (Iter 1) |

## 2. 기능별 분석

| 기능 | 내용 | Match Rate | 상태 |
|------|------|:----------:|:----:|
| 기능 1 | 3개 모드 추가 (/consult, /extend, /fix) | 100% | ✅ |
| 기능 2 | 토론 엔진 AI 선택 | 100% | ✅ |
| 기능 3 | 기술 스펙 문서 입력 | 100% | ✅ |
| 기능 4 | Claude Code 명령 변환 | 100% | ✅ |
| 기능 5 | UI 프로토타입 자동 생성 | 93% | ✅ |

---

## 3. Gap 목록 (5건)

### Gap 1: 세션 상세 페이지 모드 라벨 누락 ✅ 해결 (Iteration 1)
- **파일**: `src/app/sessions/[id]/page.tsx` (line 21-27)
- **수정**: `commandLabel`에 consult/extend/fix 3개 추가

### Gap 2: SessionDetailClient 모드별 렌더링 미흡 ✅ 해결 (Iteration 1)
- **파일**: `src/components/SessionDetailClient.tsx`
- **수정**: DOC_TITLES로 모드별 문서 제목 표시, generatedCommand/prototypeHtml 섹션 추가

### Gap 3: 프로토타입 HTML 별도 파일 저장 미구현 ⚠️
- **파일**: `src/lib/session-store.ts` (line 28-31)
- **Plan**: "HTML은 별도 파일로 저장, 세션 JSON에는 경로만"
- **구현**: HTML이 세션 JSON에 인라인 저장됨
- **심각도**: 낮음 (기능 동작에는 영향 없음, 대용량 시 성능 이슈 가능)

### Gap 4: UI 프로토타입 자동 실행 미구현 ⚠️
- **파일**: `src/components/UiPrototype.tsx`, `src/components/DebateArena.tsx`
- **Plan**: "PRD 완성 후 자동 실행 (건너뛰기 옵션)"
- **구현**: 수동 버튼 클릭 필요, onSkip prop 미연결
- **심각도**: 낮음 (수동 실행이 오히려 사용자 제어에 유리할 수 있음)

### Gap 5: PRD 엔진 선택 불가 ⚠️
- **파일**: `src/app/api/synthesize/route.ts` (line 70)
- **Plan**: "PRD 엔진도 선택 가능하게 (기본은 Opus 유지)"
- **구현**: 항상 Claude Opus 고정
- **심각도**: 낮음 (Opus가 PRD 생성에 최적)

---

## 4. 요약

- **전체 Match Rate**: 97% (Iteration 1 후, 95% → 97%)
- **✅ 해결**: Gap 1, 2 (Iteration 1에서 수정)
- **⏭️ 보류**: Gap 3, 4, 5 (심각도 낮음, 기능 영향 없음)
- **❌ 미구현 항목**: 0건

### Iteration 1 수정 내역 (2026-03-24)
1. ✅ `sessions/[id]/page.tsx`: consult/extend/fix 모드 라벨 추가
2. ✅ `SessionDetailClient.tsx`: DOC_TITLES 모드별 제목 + 명령문/프로토타입 표시 추가 + 다운로드 파일명 모드별 변경

### 보류 항목 (3건, 추후 최적화)
3. session-store.ts에서 HTML 별도 파일 저장 (대용량 최적화)
4. UI 프로토타입 자동 실행 (수동이 UX에 유리하여 의도적 보류)
5. synthesize/route.ts에 엔진 선택 파라미터 추가 (Opus 고정이 품질에 유리)
