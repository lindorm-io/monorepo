export type CreateProtectedRecordRequestBody<Data = Record<string, string>> = {
  id: string;
  data: Data;
  expires?: string | null;
};

export type CreateProtectedRecordResponse = {
  key: string;
};
