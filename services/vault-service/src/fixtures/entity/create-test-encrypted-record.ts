import { EncryptedRecord, EncryptedRecordOptions } from "../../entity";

export const createTestEncryptedRecord = (
  options: Partial<EncryptedRecordOptions> = {},
): EncryptedRecord =>
  new EncryptedRecord({
    encryptedData: "encrypted-data",
    expires: new Date("2023-01-01T08:00:00.000Z"),
    ...options,
  });
