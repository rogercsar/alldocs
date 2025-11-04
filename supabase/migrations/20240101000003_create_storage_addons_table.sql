CREATE TABLE IF NOT EXISTS public.storage_addons (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bytes bigint NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'active', 'canceled')),
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storage_addons_user_id ON public.storage_addons(user_id);

ALTER TABLE public.storage_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read own storage add-ons" ON public.storage_addons
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Allow user manage own storage add-ons" ON public.storage_addons
FOR INSERT WITH CHECK (user_id = auth.uid())
FOR UPDATE USING (user_id = auth.uid());