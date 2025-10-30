export type DocumentItem = {
  id?: number;
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
  synced?: number; // 0 or 1
  updatedAt?: number; // epoch millis
};