-- Supabase SQL Editor에서 실행하세요
-- AI Council 데이터베이스 스키마

-- 1. debates 테이블
CREATE TABLE debates (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'debate',
  topic TEXT NOT NULL,
  engine_model TEXT DEFAULT 'claude-sonnet-4-6',
  reviewer_model TEXT DEFAULT 'chatgpt',
  roles JSONB DEFAULT '[]',
  messages JSONB DEFAULT '[]',
  prd TEXT DEFAULT '',
  html_ui TEXT DEFAULT '',
  claude_command TEXT DEFAULT '',
  status TEXT DEFAULT 'idle',
  recommendation JSONB,
  harness_data JSONB,
  active_workflow TEXT DEFAULT 'standard',
  verification_provider TEXT DEFAULT '',
  verification_result TEXT DEFAULT '',
  prd_revisions JSONB DEFAULT '[]',
  revision_count INTEGER DEFAULT 0,
  feedbacks JSONB DEFAULT '[]',
  mode_input JSONB,
  clarifications JSONB,
  clarification_round INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. tech_specs 테이블
CREATE TABLE tech_specs (
  id TEXT PRIMARY KEY,
  debate_id TEXT NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ui_versions 테이블
CREATE TABLE ui_versions (
  id TEXT PRIMARY KEY,
  debate_id TEXT NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  html_code TEXT NOT NULL,
  modification_request TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 인덱스
CREATE INDEX idx_debates_topic ON debates(topic);
CREATE INDEX idx_debates_mode ON debates(mode);
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_created ON debates(created_at);
CREATE INDEX idx_tech_specs_debate ON tech_specs(debate_id);
CREATE INDEX idx_ui_versions_debate ON ui_versions(debate_id);

-- 5. 풀텍스트 검색 (PostgreSQL tsvector)
ALTER TABLE debates ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(topic, '') || ' ' || coalesce(prd, ''))
  ) STORED;

CREATE INDEX idx_debates_fts ON debates USING GIN(fts);

-- 6. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER debates_updated_at
  BEFORE UPDATE ON debates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. RLS (Row Level Security) - 공개 접근 허용
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on debates" ON debates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tech_specs" ON tech_specs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ui_versions" ON ui_versions FOR ALL USING (true) WITH CHECK (true);
