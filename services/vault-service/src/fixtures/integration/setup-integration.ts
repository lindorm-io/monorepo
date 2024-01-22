import { createTestStoredKeySet } from "@lindorm-io/keystore";
import { StoredKeySetRedisRepository } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import {
  EncryptedRecordRepository,
  EncryptionKeyRepository,
  ProtectedRecordRepository,
} from "../../infrastructure";
import { mongoConnection, redisConnection } from "../../instance";

export let TEST_ENCRYPTED_RECORD_REPOSITORY: EncryptedRecordRepository;
export let TEST_ENCRYPTION_KEY_REPOSITORY: EncryptionKeyRepository;
export let TEST_PROTECTED_RECORD_REPOSITORY: ProtectedRecordRepository;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();

  TEST_ENCRYPTED_RECORD_REPOSITORY = new EncryptedRecordRepository(mongoConnection, logger);
  TEST_ENCRYPTION_KEY_REPOSITORY = new EncryptionKeyRepository(mongoConnection, logger);
  TEST_PROTECTED_RECORD_REPOSITORY = new ProtectedRecordRepository(mongoConnection, logger);

  const keyPairCache = new StoredKeySetRedisRepository(redisConnection, logger);
  await keyPairCache.create(createTestStoredKeySet());
};
