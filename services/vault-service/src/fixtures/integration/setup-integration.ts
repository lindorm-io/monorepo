import { EncryptedRecordRepository, ProtectedRecordRepository } from "../../infrastructure";
import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { mongoConnection, redisConnection } from "../../instance";

export let TEST_ENCRYPTED_RECORD_REPOSITORY: EncryptedRecordRepository;
export let TEST_PROTECTED_RECORD_REPOSITORY: ProtectedRecordRepository;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();
  await redisConnection.connect();

  TEST_ENCRYPTED_RECORD_REPOSITORY = new EncryptedRecordRepository({
    connection: mongoConnection,
    logger,
  });
  TEST_PROTECTED_RECORD_REPOSITORY = new ProtectedRecordRepository({
    connection: mongoConnection,
    logger,
  });

  const keyPairCache = new KeyPairCache({
    connection: redisConnection,
    logger,
  });
  await keyPairCache.create(createTestKeyPair());
};
