export type DocumentItem = {
  id?: number;
  name: string;
  number: string;
  frontImageUri?: string;
  backImageUri?: string;
  synced?: number; // 0 or 1
  updatedAt?: number; // epoch millis
};