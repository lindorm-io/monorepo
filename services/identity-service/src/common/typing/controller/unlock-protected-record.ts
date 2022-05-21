export interface UnlockProtectedRecordRequestBody {
  key: string;
}

export interface UnlockProtectedRecordResponseBody<Data = Record<string, string>> {
  data: Data;
  expires: Date | null;
}
