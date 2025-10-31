export type DocumentItem = {
  id?: number; // ID local (SQLite/memória)
  appId?: string; // ID global único para sincronização
  name: string;
  number: string;
  frontImageUri?: string;
  backImageUri?: string;
  type?: string; // tipo de documento (ex.: RG, CNH, CPF)
  // Campos adicionais para RG/CNH
  issueDate?: string; // Data de Expedição
  expiryDate?: string; // Data de Vencimento
  issuingState?: string; // UF
  issuingCity?: string; // Cidade
  issuingAuthority?: string; // Órgão Emissor
  // Campos Título de Eleitor
  electorZone?: string; // Zona Eleitoral
  electorSection?: string; // Seção Eleitoral
  favorite?: number; // 0 or 1
  synced?: number; // 0 or 1
  updatedAt?: number; // epoch millis
};