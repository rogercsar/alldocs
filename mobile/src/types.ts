export type DocumentItem = {
  id?: number;
  name: string;
  number: string;
  frontImageUri?: string;
  backImageUri?: string;
  type?: string; // tipo de documento (ex.: RG, CNH, CPF)
  synced?: number; // 0 or 1
  updatedAt?: number; // epoch millis
};