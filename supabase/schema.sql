-- =============================================================================
-- GhostFix — Supabase Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New Query)
-- =============================================================================


-- =============================================================================
-- TABLE 1: incoming_tickets
-- Stores every bug report submitted through GhostFix.
-- 'source' is free-text — can be "Web Form", "API", "Slack", anything you want.
-- =============================================================================
CREATE TABLE public.incoming_tickets (
    id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    source                TEXT          NOT NULL DEFAULT 'Web Form',
                                        -- Free-text: "Web Form", "API", "Slack", "Email", etc.
                                        -- No hard restriction — accepts any string.
    user_email            TEXT          NOT NULL,
    issue_text            TEXT          NOT NULL,
    status                TEXT          NOT NULL DEFAULT 'pending'
                                        CHECK (status IN (
                                            'pending',      -- just received
                                            'analyzing',    -- AI triage in progress
                                            'patched',      -- ghost env deployed, link sent
                                            'resolved',     -- user confirmed fix worked
                                            'escalated'     -- needs manual review
                                        )),
    failing_module        TEXT,         -- AI-identified module causing the issue
    triage_summary        TEXT,         -- AI one-sentence fix description
    generated_ghost_link  TEXT,         -- URL to the temporary hotfix environment
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by status (used in the dashboard queue)
CREATE INDEX idx_incoming_tickets_status    ON public.incoming_tickets (status);
-- Index for fast lookups by email (used when a user checks their ticket history)
CREATE INDEX idx_incoming_tickets_email     ON public.incoming_tickets (user_email);


-- =============================================================================
-- TABLE 2: historical_fixes
-- The AI's knowledge base: known error signatures + their proven resolutions.
-- =============================================================================
CREATE TABLE public.historical_fixes (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    error_signature     TEXT        NOT NULL UNIQUE,    -- keyword/phrase the AI matches against
    proposed_solution   TEXT        NOT NULL,           -- plain-English description of the fix
    mock_patch_code     TEXT        NOT NULL,           -- simulated diff / patch shown to the user
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- To add created_at to an existing historical_fixes table, run:
-- ALTER TABLE public.historical_fixes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Full-text search index so the AI can do fuzzy matching on error signatures
CREATE INDEX idx_historical_fixes_fts
    ON public.historical_fixes
    USING GIN (to_tsvector('english', error_signature || ' ' || proposed_solution));


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.incoming_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_fixes  ENABLE ROW LEVEL SECURITY;

-- Anyone (anon role) can INSERT a new ticket (i.e., submit a bug report)
CREATE POLICY "Public can submit tickets"
    ON public.incoming_tickets
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Users can only SELECT their own tickets
CREATE POLICY "Users see own tickets"
    ON public.incoming_tickets
    FOR SELECT
    TO authenticated
    USING (user_email = auth.jwt() ->> 'email');

-- Service role (your Next.js API routes) has full unrestricted access
-- NOTE: The Supabase service_role key bypasses RLS by default.
-- These explicit policies are a safety net for any future role changes.
CREATE POLICY "Service role full access on tickets"
    ON public.incoming_tickets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on historical_fixes"
    ON public.historical_fixes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read historical fixes (for any future public API)
CREATE POLICY "Authenticated users can read fixes"
    ON public.historical_fixes
    FOR SELECT
    TO authenticated
    USING (true);


-- =============================================================================
-- SEED DATA — historical_fixes
-- These are the AI's pre-loaded knowledge base entries.
-- Add more rows as your SRE team documents new resolutions.
-- =============================================================================
INSERT INTO public.historical_fixes (error_signature, proposed_solution, mock_patch_code)
VALUES
(
    'AppTier connection timeout',
    'The AppTier module is failing due to a stale connection pool. The hotfix resets the pool and increases the connection timeout threshold from 2s to 5s, preventing cascade failures under load.',
    E'diff --git a/src/services/appTier.ts b/src/services/appTier.ts\n'
    '--- a/src/services/appTier.ts\n'
    '+++ b/src/services/appTier.ts\n'
    '@@ -12,7 +12,8 @@ const poolConfig = {\n'
    '-  connectionTimeoutMillis: 2000,\n'
    '+  connectionTimeoutMillis: 5000,\n'
    '+  idleTimeoutMillis: 30000,\n'
    '   max: 10,\n'
    ' };'
),
(
    'authentication token expiry JWT',
    'JWT tokens are expiring prematurely due to clock skew between auth servers. The hotfix adds a 5-minute (300s) tolerance to token validation, eliminating false "session expired" errors.',
    E'diff --git a/src/middleware/auth.ts b/src/middleware/auth.ts\n'
    '--- a/src/middleware/auth.ts\n'
    '+++ b/src/middleware/auth.ts\n'
    '@@ -8,3 +8,3 @@ const verifyToken = (token: string) => {\n'
    '-  return jwt.verify(token, SECRET);\n'
    '+  return jwt.verify(token, SECRET, { clockTolerance: 300 });\n'
    ' };'
),
(
    'dashboard not loading 504 slow blank screen',
    'The dashboard API is returning 504 Gateway Timeouts due to a missing database index on the analytics table. The hotfix adds the index and wraps the query in a 5-minute Redis cache layer.',
    E'diff --git a/src/api/dashboard.ts b/src/api/dashboard.ts\n'
    '--- a/src/api/dashboard.ts\n'
    '+++ b/src/api/dashboard.ts\n'
    '@@ -5,5 +5,10 @@ export async function getDashboardData(userId: string) {\n'
    '+  // HOTFIX: Redis cache — prevents repeated slow queries causing 504s\n'
    '+  const cached = await redis.get(`dashboard:${userId}`);\n'
    '+  if (cached) return JSON.parse(cached);\n'
    '+\n'
    '   const data = await db.query(\n'
    '     `SELECT * FROM analytics WHERE user_id = $1 ORDER BY created_at DESC`,\n'
    '     [userId]\n'
    '   );\n'
    '+  await redis.set(`dashboard:${userId}`, JSON.stringify(data), { EX: 300 });\n'
    '   return data;\n'
    ' }'
),
(
    'file upload fails large files CORS error',
    'Large file uploads are failing due to a 10MB payload limit set in the API gateway config and a missing CORS header for the storage endpoint. The hotfix raises the limit to 100MB and adds the correct header.',
    E'diff --git a/src/config/gateway.ts b/src/config/gateway.ts\n'
    '--- a/src/config/gateway.ts\n'
    '+++ b/src/config/gateway.ts\n'
    '@@ -3,4 +3,5 @@ export const gatewayConfig = {\n'
    '-  maxPayloadSize: "10mb",\n'
    '+  maxPayloadSize: "100mb",\n'
    '+  corsHeaders: { "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN },\n'
    ' };'
),
(
    'email notifications not sending stuck queued',
    'The email worker is silently failing because the SMTP credentials rotated last week and the environment variable was not updated in production. The hotfix re-points the mailer to the correct credentials key.',
    E'diff --git a/src/workers/mailer.ts b/src/workers/mailer.ts\n'
    '--- a/src/workers/mailer.ts\n'
    '+++ b/src/workers/mailer.ts\n'
    '@@ -7,3 +7,3 @@ const transporter = nodemailer.createTransport({\n'
    '-  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },\n'
    '+  auth: { user: process.env.SMTP_USER_V2, pass: process.env.SMTP_PASS_V2 },\n'
    ' });'
);
