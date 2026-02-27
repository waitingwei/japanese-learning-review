-- Japanese Learning Review Tool — Neon Postgres schema
-- Run this in Neon SQL Editor or via psql after creating a project.
-- Tables are scoped by user_id (Clerk user id).

-- Grammar
CREATE TABLE IF NOT EXISTS grammar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'grammar',
  title TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  example_sentence TEXT NOT NULL DEFAULT '',
  example_translation TEXT NOT NULL DEFAULT '',
  lesson TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_review_at DATE NOT NULL DEFAULT CURRENT_DATE,
  interval_days INT NOT NULL DEFAULT 0,
  ease_factor NUMERIC(5,2) NOT NULL DEFAULT 2.5
);

CREATE INDEX IF NOT EXISTS idx_grammar_user_id ON grammar (user_id);
CREATE INDEX IF NOT EXISTS idx_grammar_next_review ON grammar (user_id, next_review_at);

-- Vocabulary (conjugation stored as JSONB)
CREATE TABLE IF NOT EXISTS vocab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'vocab',
  word TEXT NOT NULL,
  reading TEXT NOT NULL DEFAULT '',
  meaning TEXT NOT NULL DEFAULT '',
  example_sentence TEXT NOT NULL DEFAULT '',
  lesson TEXT NOT NULL DEFAULT '',
  conjugation_summary TEXT,
  conjugation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_review_at DATE NOT NULL DEFAULT CURRENT_DATE,
  interval_days INT NOT NULL DEFAULT 0,
  ease_factor NUMERIC(5,2) NOT NULL DEFAULT 2.5
);

CREATE INDEX IF NOT EXISTS idx_vocab_user_id ON vocab (user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_next_review ON vocab (user_id, next_review_at);

-- Sentences
CREATE TABLE IF NOT EXISTS sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'sentence',
  japanese_text TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT '',
  linked_grammar TEXT,
  lesson TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_review_at DATE NOT NULL DEFAULT CURRENT_DATE,
  interval_days INT NOT NULL DEFAULT 0,
  ease_factor NUMERIC(5,2) NOT NULL DEFAULT 2.5
);

CREATE INDEX IF NOT EXISTS idx_sentences_user_id ON sentences (user_id);
CREATE INDEX IF NOT EXISTS idx_sentences_next_review ON sentences (user_id, next_review_at);
