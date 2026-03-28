-- Add clarification columns for ideate mode
-- Run this in Supabase SQL Editor

ALTER TABLE debates ADD COLUMN IF NOT EXISTS clarifications JSONB DEFAULT NULL;
ALTER TABLE debates ADD COLUMN IF NOT EXISTS clarification_round INTEGER DEFAULT 0;
