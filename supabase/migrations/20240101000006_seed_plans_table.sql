INSERT INTO public.plans (name, price_month, base_quota_bytes, features_json, is_active) VALUES
    ('Plano Gratuito', 0, 1073741824, '{"feature1": "basic", "feature2": "limited"}', TRUE),
    ('Plano Premium', 19.90, 10737418240, '{"feature1": "premium", "feature2": "unlimited"}', TRUE);