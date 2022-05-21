export interface CreateProtectedRecordRequestBody<Data = Record<string, string>> {
  id: string;
  data: Data;
  expires?: string | null;
}

export interface CreateProtectedRecordResponseBody {
  key: string;
}
