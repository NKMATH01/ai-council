-- 심판(Judge) 판정 전용 저장 컬럼 추가 (idempotent)
-- 적용 방법: Supabase Dashboard > SQL Editor 에서 이 파일 전체를 실행
-- 미적용 시: session-store.ts가 자동으로 legacy fallback (recommendation JSONB의 _judgeVerdicts) 사용
-- 적용 후: dedicated 저장 활성, legacy 데이터 자동 이전, recommendation에서 _judgeVerdicts 제거

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS judge_verdicts JSONB;

UPDATE debates
SET
  judge_verdicts = recommendation -> '_judgeVerdicts',
  recommendation = CASE
    WHEN recommendation IS NULL THEN NULL
    ELSE recommendation - '_judgeVerdicts'
  END
WHERE recommendation IS NOT NULL
  AND recommendation ? '_judgeVerdicts';
