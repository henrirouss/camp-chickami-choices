-- ── 1. Extend activities table ────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE activities ADD COLUMN is_custom BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE activities ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── 2. Extra period choices on campers (supports sessions with 4–5 periods) ──
DO $$ BEGIN
  ALTER TABLE campers ADD COLUMN choice_p4 TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE campers ADD COLUMN choice_p5 TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── 3. Sessions table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  period_count INTEGER     NOT NULL DEFAULT 3,
  periods      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  activities   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_active    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sessions_select" ON sessions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "sessions_insert" ON sessions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "sessions_update" ON sessions FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "sessions_delete" ON sessions FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Link session-scoped activities back to their session ───────────────────
DO $$ BEGIN
  ALTER TABLE activities ADD COLUMN session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── 5. Allow deleting activities (custom + session activity cleanup) ──────────
DO $$ BEGIN
  CREATE POLICY "activities_delete" ON activities FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'Migration 008 complete' AS result;
