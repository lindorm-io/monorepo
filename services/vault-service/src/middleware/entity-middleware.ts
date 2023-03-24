import { EncryptedRecord, ProtectedRecord } from "../entity";
import { EncryptedRecordRepository, ProtectedRecordRepository } from "../infrastructure";
import { mongoRepositoryEntityMiddleware } from "@lindorm-io/koa-mongo";

export const encryptedRecordEntityMiddleware = mongoRepositoryEntityMiddleware(
  EncryptedRecord,
  EncryptedRecordRepository,
);

export const protectedRecordEntityMiddleware = mongoRepositoryEntityMiddleware(
  ProtectedRecord,
  ProtectedRecordRepository,
);
