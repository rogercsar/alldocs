CREATE TABLE IF NOT EXISTS public.usage_cache (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    used_bytes bigint NOT NULL DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.usage_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read own usage" ON public.usage_cache
FOR SELECT USING (user_id = auth.uid());