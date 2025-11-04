-- View unificada de documentos com metadados por tipo
-- Execute no SQL Editor do Supabase (schema public)

CREATE OR REPLACE VIEW public.documents_unified_view AS
SELECT 
  d.user_id,
  d.app_id,
  d.name,
  d.number,
  d.type,
  d.category,
  d.front_path,
  d.back_path,
  d.updated_at,
  COALESCE(d.issue_date, rg.issue_date, cnh.issue_date, pass.issue_date) AS issue_date,
  COALESCE(d.expiry_date, cnh.expiry_date, pass.expiry_date, cart.expiry_date, saude.expiry_date) AS expiry_date,
  COALESCE(d.issuing_state, rg.issuing_state, cnh.issuing_state) AS issuing_state,
  COALESCE(d.issuing_city, rg.issuing_city, cnh.issuing_city) AS issuing_city,
  COALESCE(d.issuing_authority, rg.issuing_authority, cnh.issuing_authority, pass.issuing_authority) AS issuing_authority,
  ele.elector_zone,
  ele.elector_section,
  cart.subtype AS card_subtype,
  cart.brand AS card_brand,
  cart.bank AS bank,
  cart.cvc AS cvc
FROM public.documents d
LEFT JOIN public.doc_rg rg ON rg.user_id = d.user_id AND rg.app_id = d.app_id
LEFT JOIN public.doc_cnh cnh ON cnh.user_id = d.user_id AND cnh.app_id = d.app_id
LEFT JOIN public.doc_eleitor ele ON ele.user_id = d.user_id AND ele.app_id = d.app_id
LEFT JOIN public.doc_passaporte pass ON pass.user_id = d.user_id AND pass.app_id = d.app_id
LEFT JOIN public.doc_cartao cart ON cart.user_id = d.user_id AND cart.app_id = d.app_id
LEFT JOIN public.doc_saude saude ON saude.user_id = d.user_id AND saude.app_id = d.app_id;