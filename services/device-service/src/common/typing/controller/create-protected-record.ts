export interface CreateProtectedRecordRequestBody {
  id: string;
  data: Record<string, string>;
  expires: string | null;
}

export interface CreateProtectedRecordResponseBody {
  key: string;
}
