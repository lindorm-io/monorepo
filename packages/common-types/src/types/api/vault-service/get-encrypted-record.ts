export type GetEncryptedRecordRequestParams = {
  id: string;
};

export type GetEncryptedRecordResponse<Data = Record<string, string>> = {
  data: Data;
  expires: Date | null;
};
