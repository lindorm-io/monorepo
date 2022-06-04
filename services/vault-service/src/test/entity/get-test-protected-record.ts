import { ProtectedRecord, ProtectedRecordOptions } from "../../entity";

export const getTestProtectedRecord = (
  options: Partial<ProtectedRecordOptions> = {},
): ProtectedRecord =>
  new ProtectedRecord({
    expires: new Date("2023-01-01T08:00:00.000Z"),
    owner: "9168f571-2f25-4960-a585-330d1a07c094",
    ownerType: "client",
    protectedData: "protected-data",
    ...options,
  });
