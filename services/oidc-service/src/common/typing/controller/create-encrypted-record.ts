export interface CreateEncryptedRecordRequestBody<Data = Record<string, string>> {
  id: string;
  data: Data;
  expires?: string | null;
}
