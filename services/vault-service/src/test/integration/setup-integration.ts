import { getTestKeyPairEC } from "./test-key-pair";
import { EncryptedRecordRepository, ProtectedRecordRepository } from "../../infrastructure";
import { mongoConnection, redisConnection } from "../../instance";
import { logger } from "../logger";
import { KeyPairCache } from "@lindorm-io/koa-keystore";

export let TEST_ENCRYPTED_RECORD_REPOSITORY: EncryptedRecordRepository;
export let TEST_PROTECTED_RECORD_REPOSITORY: ProtectedRecordRepository;

export const setupIntegration = async (): Promise<void> => {
  TEST_ENCRYPTED_RECORD_REPOSITORY = new EncryptedRecordRepository({
    connection: mongoConnection,
    logger,
  });
  TEST_PROTECTED_RECORD_REPOSITORY = new ProtectedRecordRepository({
    connection: mongoConnection,
    logger,
  });

  const keyPairCache = new KeyPairCache({ connection: redisConnection, logger });
  await keyPairCache.create(getTestKeyPairEC());
};
