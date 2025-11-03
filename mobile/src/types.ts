export type DocumentItem = {
  id?: number; // ID local (SQLite/memória)
  appId?: string; // ID global único para sincronização
  name: string;
  number: string;
  frontImageUri?: string;
  backImageUri?: string;
  type?: string; // tipo de documento (ex.: RG, CNH, CPF, Cartões)
  // Campos adicionais para RG/CNH
  issueDate?: string; // Data de Expedição
  expiryDate?: string; // Data de Vencimento (para Cartões: Validade)
  issuingState?: string; // UF
  issuingCity?: string; // Cidade
  issuingAuthority?: string; // Órgão Emissor
  // Campos Título de Eleitor
  electorZone?: string; // Zona Eleitoral
  electorSection?: string; // Seção Eleitoral
  // Campos Cartões
  cardSubtype?: string; // Crédito, Débito, Plano de saúde, Outro
  bank?: string; // Banco emissor (para Crédito/Débito)
  cvc?: string; // CVC/CVV (3-4 dígitos)
  cardBrand?: string; // Bandeira (Visa, MasterCard, Elo, etc.)
  // Gerais
  category?: string; // Categoria do documento (Pessoais, Financeiro, Saúde, Transporte)
  favorite?: number; // 0 or 1
  synced?: number; // 0 or 1
  updatedAt?: number; // epoch millis
};