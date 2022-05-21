export interface GetEncryptedRecordResponseBody<Data = Record<string, string>> {
  data: Data;
  expires: Date | null;
}
