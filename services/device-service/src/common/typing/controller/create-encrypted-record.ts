export interface CreateEncryptedRecordRequestBody {
  id: string;
  data: Record<string, string>;
  expires: string | null;
}
