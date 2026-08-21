-- P4: AI Telemetry improvements
-- Separate estimated prefix-cache savings from actual provider KV-cache metrics,
-- rename the estimate column, and add retry/cost tracking.

-- Add retry_count column (number of retries performed for this call).
ALTER TABLE ai_logs ADD COLUMN retry_count INTEGER DEFAULT 0;

-- Add cost_usd column (estimated cost of the call).
ALTER TABLE ai_logs ADD COLUMN cost_usd REAL DEFAULT 0;

-- Rename cache_savings_tokens to estimated_prefix_cache_savings to clarify
-- it is an estimate, not an actual provider KV-cache metric.
ALTER TABLE ai_logs RENAME COLUMN cache_savings_tokens TO estimated_prefix_cache_savings;

-- Actual provider KV-cache metrics (from OpenRouter usage.prompt_tokens_details).
-- cache_read_input_tokens: tokens served from provider KV cache (cache hit).
-- cache_creation_input_tokens: tokens written to provider KV cache (cache miss).
ALTER TABLE ai_logs ADD COLUMN cache_read_input_tokens INTEGER DEFAULT 0;
ALTER TABLE ai_logs ADD COLUMN cache_creation_input_tokens INTEGER DEFAULT 0;
