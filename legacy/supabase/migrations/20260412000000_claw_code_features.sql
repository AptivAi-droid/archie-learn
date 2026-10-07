-- ============================================================
-- Migration: Claude Code Architecture Features
-- Archie Learn — claw-code integration
-- Date: 12 April 2026
-- Features: BUDDY, AutoDream, KAIROS, Coordinator, ULTRAPLAN
-- ============================================================

-- ── 1. BUDDY — Companion system ─────────────────────────────
CREATE TABLE IF NOT EXISTS buddy_companions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buddy_data    JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_buddy_companions_user_id ON buddy_companions(user_id);

ALTER TABLE buddy_companions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own buddy"
  ON buddy_companions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. LEARNER MEMORY — AutoDream consolidation ─────────────
CREATE TABLE IF NOT EXISTS learner_memory (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_text                 TEXT,
  session_count_since_dream   INTEGER DEFAULT 0,
  total_dreams                INTEGER DEFAULT 0,
  last_consolidated_at        TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_memory_user_id ON learner_memory(user_id);

ALTER TABLE learner_memory ENABLE ROW LEVEL SECURITY;
-- Service role only — backend writes, frontend reads own row
CREATE POLICY "Users can read own memory"
  ON learner_memory FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can write memory"
  ON learner_memory FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 3. CURRICULA — Coordinator-generated learning paths ─────
CREATE TABLE IF NOT EXISTS curricula (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curriculum_data   JSONB NOT NULL DEFAULT '{}',
  active            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_curricula_user_id ON curricula(user_id);

ALTER TABLE curricula ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own curriculum"
  ON curricula FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can write curriculum"
  ON curricula FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 4. ULTRAPLANS — Deep planning outputs ───────────────────
CREATE TABLE IF NOT EXISTS ultraplans (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type   TEXT NOT NULL CHECK (plan_type IN ('exam_prep_12week', 'subject_mastery', 'recovery_plan')),
  plan_text   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ultraplans_user_id ON ultraplans(user_id);

ALTER TABLE ultraplans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own ultraplans"
  ON ultraplans FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert ultraplans"
  ON ultraplans FOR INSERT
  WITH CHECK (true);

-- ── 5. SESSION COUNT TRIGGER — increments AutoDream counter ─
-- Automatically increments session_count_since_dream on each new chat_session
CREATE OR REPLACE FUNCTION increment_dream_session_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO learner_memory (user_id, session_count_since_dream, created_at, updated_at)
  VALUES (NEW.user_id, 1, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET session_count_since_dream = learner_memory.session_count_since_dream + 1,
        updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_chat_session_created ON chat_sessions;
CREATE TRIGGER on_chat_session_created
  AFTER INSERT ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION increment_dream_session_count();

-- ── 6. Updated_at trigger helper ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_buddy_updated_at
  BEFORE UPDATE ON buddy_companions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_memory_updated_at
  BEFORE UPDATE ON learner_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_curricula_updated_at
  BEFORE UPDATE ON curricula
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
