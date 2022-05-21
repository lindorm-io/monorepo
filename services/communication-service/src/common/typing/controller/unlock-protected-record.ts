export interface UnlockProtectedRecordRequestBody {
  key: string;
}

export interface UnlockProtectedRecordResponseBody {
  data: Record<string, string>;
  expires: Date | null;
}
