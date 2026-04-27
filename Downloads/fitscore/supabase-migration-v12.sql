-- Run this in Supabase SQL Editor to add cache_key for deterministic scoring

ALTER TABLE public.analyses
ADD COLUMN IF NOT EXISTS cache_key text;

CREATE INDEX IF NOT EXISTS idx_analyses_cache
ON public.analyses(user_id, cache_key);
