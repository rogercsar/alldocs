CREATE TABLE IF NOT EXISTS public.plans (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    price_month numeric NOT NULL,
    base_quota_bytes bigint NOT NULL,
    features_json jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT TRUE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.plans FOR SELECT USING (TRUE);