import { createTestKeyPair } from "@lindorm-io/key-pair";
import { KeyPairMemoryCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import {
  EncryptedRecordRepository,
  EncryptionKeyRepository,
  ProtectedRecordRepository,
} from "../../infrastructure";
import { memoryDatabase, mongoConnection } from "../../instance";

export let TEST_ENCRYPTED_RECORD_REPOSITORY: EncryptedRecordRepository;
export let TEST_ENCRYPTION_KEY_REPOSITORY: EncryptionKeyRepository;
export let TEST_PROTECTED_RECORD_REPOSITORY: ProtectedRecordRepository;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();

  TEST_ENCRYPTED_RECORD_REPOSITORY = new EncryptedRecordRepository(mongoConnection, logger);
  TEST_ENCRYPTION_KEY_REPOSITORY = new EncryptionKeyRepository(mongoConnection, logger);
  TEST_PROTECTED_RECORD_REPOSITORY = new ProtectedRecordRepository(mongoConnection, logger);

  const keyPairCache = new KeyPairMemoryCache(memoryDatabase, logger);
  await keyPairCache.create(createTestKeyPair());
};
