-- Script para criação de sub-tabelas por tipo de documento e suporte a categorias
-- Execute no Supabase (SQL Editor) no schema public

-- 1) Garantir colunas básicas em documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS front_path TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS back_path TEXT;

-- 2) Índice único por (user_id, app_id) para suportar FKs compostas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'documents_user_app_unique'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX documents_user_app_unique ON public.documents (user_id, app_id)';
  END IF;
END $$;

-- 3) Sub-tabelas por tipo
-- Observação: chave primária composta (user_id, app_id) e FK para documents(user_id, app_id)

-- RG
CREATE TABLE IF NOT EXISTS public.doc_rg (
  user_id UUID NOT NULL,
  app_id INT4 NOT NULL,
  issue_date DATE,
  issuing_state TEXT,
  issuing_city TEXT,
  issuing_authority TEXT,
  PRIMARY KEY (user_id, app_id),
  CONSTRAINT fk_rg_document FOREIGN KEY (user_id, app_id)
    REFERENCES public.documents (user_id, app_id) ON DELETE CASCADE
);

-- CNH
CREATE TABLE IF NOT EXISTS public.doc_cnh (
  user_id UUID NOT NULL,
  app_id INT4 NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  issuing_state TEXT,
  issuing_city TEXT,
  issuing_authority TEXT,
  PRIMARY KEY (user_id, app_id),
  CONSTRAINT fk_cnh_document FOREIGN KEY (user_id, app_id)
    REFERENCES public.documents (user_id, app_id) ON DELETE CASCADE
);

-- CPF (metadados mínimos)
CREATE TABLE IF NOT EXISTS public.doc_cpf (
  user_id UUID NOT NULL,
  app_id INT4 NOT NULL,
  PRIMARY KEY (user_id, app_id),
  CONSTRAINT fk_cpf_document FOREIGN KEY (user_id, app_id)
    REFERENCES public.documents (user_id, app_id) ON DELETE CASCADE
);

-- Passaporte
CREATE TABLE IF NOT EXISTS public.doc_passaporte (
  user_id UUID NOT NULL,
  app_id INT4 NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  issuing_authority TEXT,
  PRIMARY KEY (user_id, app_id),
  CONSTRAINT fk_passaporte_document FOREIGN KEY (user_id, app_id)
    REFERENCES public.documents (user_id, app_id) ON DELETE CASCADE
);

-- Título de Eleitor
CREATE TABLE IF NOT EXISTS public.doc_eleitor (
  user_id UUID NOT NULL,
  app_id INT4 NOT NULL,
  elector_zone TEXT,
  elector_section TEXT,
  PRIMARY KEY (user_id, app_id),
  CONSTRAINT fk_eleitor_document FOREIGN KEY (user_id, app_id)
    REFERENCES public.documents (user_id, app_id) ON DELETE CASCADE
);

-- Documento do Veículo
CREATE TABLE IF NOT EXISTS public.doc_veiculo (
  user_id UUID NOT NULL,
  app_id INT4 NOT NULL,
  plate TEXT,
  renavam TEXT,
  PRIMARY KEY (user_id, app_id),
  CONSTRAINT fk_veiculo_document FOREIGN KEY (user_id, app_id)
    REFERENCES public.documents (user_id, app_id) ON DELETE CASCADE
);

-- Cartões (banco, planos de saúde, transporte, etc.)
-- Use o campo subtype para diferenciar: 'crédito', 'débito', 'plano_saude', 'transporte', 'outro'
CREATE TABLE IF NOT EXISTS public.doc_cartao (
  user_id UUID NOT NULL,
  app_id INT4 NOT NULL,
  subtype TEXT,
  brand TEXT,
  bank TEXT,
  cvc TEXT,
  expiry_date DATE,
  PRIMARY KEY (user_id, app_id),
  CONSTRAINT fk_cartao_document FOREIGN KEY (user_id, app_id)
    REFERENCES public.documents (user_id, app_id) ON DELETE CASCADE
);

-- 4) (Opcional) Índices auxiliares para consultas
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents (category);
CREATE INDEX IF NOT EXISTS idx_doc_cartao_subtype ON public.doc_cartao (subtype);
CREATE INDEX IF NOT EXISTS idx_doc_eleitor_zone ON public.doc_eleitor (elector_zone);

-- 5) (Opcional) Atualizar categoria derivada nos registros existentes (ajuste conforme necessidade)
-- Exemplo de regra simples:
-- Transporte: type = 'Documento do veículo' OR doc_cartao.subtype LIKE '%transporte%'
-- Saúde: doc_cartao.subtype LIKE '%saúde%' OR '%plano%'
-- Financeiro: type = 'Cartões' (quando não entra nas anteriores)
-- Pessoais: demais tipos
-- Essas atualizações podem ser feitas via funções ou scripts específicos conforme seu dataset.