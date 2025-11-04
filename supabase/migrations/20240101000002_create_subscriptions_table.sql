CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id uuid REFERENCES public.plans(id),
    status text NOT NULL CHECK (status IN ('active', 'past_due', 'canceled')),
    current_period_end timestamp with time zone,
    auto_renew boolean DEFAULT TRUE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read own subscriptions" ON public.subscriptions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Allow user manage own subscriptions" ON public.subscriptions
FOR INSERT WITH CHECK (user_id = auth.uid())
FOR UPDATE USING (user_id = auth.uid());