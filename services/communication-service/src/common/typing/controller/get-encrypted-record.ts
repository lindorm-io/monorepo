export interface GetEncryptedRecordResponseBody {
  data: Record<string, string>;
  expires: Date | null;
}
