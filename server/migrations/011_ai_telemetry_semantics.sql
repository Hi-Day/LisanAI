-- P0 Semantics (PRD Observability Redesign v1.0): distinguish "not measured"
-- from "measured as zero" for provider KV-cache telemetry.
--
-- kv_cache_measured = 1 when the provider actually reported cache usage
-- (native_tokens_cached or prompt_tokens_details.cached_tokens) for the call,
-- even if the reported hit count is 0. This lets the dashboard show
-- "Not available" instead of a false zero for providers that never report
-- KV-cache telemetry.
ALTER TABLE ai_logs ADD COLUMN kv_cache_measured INTEGER NOT NULL DEFAULT 0;