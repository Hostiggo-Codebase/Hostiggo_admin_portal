-- =============================================================================
-- Migration 0004: Rate limiting (moved to 0003 for dependency reasons,
-- this migration is intentionally a no-op placeholder).
-- The rate-limit trigger was created in 0003_assignment_engine.sql because
-- it must exist before any send_message RPC calls occur.
-- =============================================================================

-- No-op: rate limit trigger already installed in 0003.
