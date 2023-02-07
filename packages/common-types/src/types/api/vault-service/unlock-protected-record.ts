export type UnlockProtectedRecordRequestParams = {
  id: string;
};

export type UnlockProtectedRecordRequestBody = {
  key: string;
};

export type UnlockProtectedRecordResponse<Data = Record<string, string>> = {
  data: Data;
  expires: Date | null;
};
