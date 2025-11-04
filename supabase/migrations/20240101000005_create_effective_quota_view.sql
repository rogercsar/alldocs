CREATE OR REPLACE VIEW public.effective_quota_view AS
SELECT
    u.id AS user_id,
    COALESCE(p.base_quota_bytes, 0) + COALESCE(sa.total_addon_bytes, 0) AS effective_quota_bytes
FROM
    auth.users u
LEFT JOIN
    public.subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN
    public.plans p ON s.plan_id = p.id
LEFT JOIN
    (SELECT user_id, SUM(bytes) AS total_addon_bytes FROM public.storage_addons WHERE status = 'active' GROUP BY user_id) sa ON u.id = sa.user_id;