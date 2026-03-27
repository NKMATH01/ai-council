-- 하네스 전용 저장 컬럼 추가 (idempotent)
-- 적용 방법: Supabase Dashboard > SQL Editor 에서 이 파일 전체를 실행
-- 미적용 시: session-store.ts가 자동으로 legacy fallback (recommendation JSONB) 사용
-- 적용 후: dedicated 저장 활성, legacy 데이터 자동 이전, recommendation에서 _harness 제거

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS harness_data JSONB,
  ADD COLUMN IF NOT EXISTS active_workflow TEXT DEFAULT 'standard';

UPDATE debates
SET
  harness_data = recommendation -> '_harness',
  active_workflow = COALESCE(
    recommendation ->> '_activeWorkflow',
    CASE
      WHEN recommendation ? '_harness' THEN 'plan_harness'
      ELSE active_workflow
    END
  ),
  recommendation = CASE
    WHEN recommendation IS NULL THEN NULL
    ELSE recommendation - '_harness' - '_activeWorkflow'
  END
WHERE recommendation IS NOT NULL
  AND recommendation ? '_harness';
