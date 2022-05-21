import { EncryptedRecord, ProtectedRecord } from "../entity";
import { EncryptedRecordRepository, ProtectedRecordRepository } from "../infrastructure";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";

export const encryptedRecordEntityMiddleware = repositoryEntityMiddleware(
  EncryptedRecord,
  EncryptedRecordRepository,
);

export const protectedRecordEntityMiddleware = repositoryEntityMiddleware(
  ProtectedRecord,
  ProtectedRecordRepository,
);
