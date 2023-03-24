import { KeyPairMemoryCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { memoryDatabase, mongoConnection } from "../../instance";
import {
  AddressRepository,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../../infrastructure";

export let TEST_ADDRESS_REPOSITORY: AddressRepository;
export let TEST_DISPLAY_NAME_REPOSITORY: DisplayNameRepository;
export let TEST_IDENTIFIER_REPOSITORY: IdentifierRepository;
export let TEST_IDENTITY_REPOSITORY: IdentityRepository;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();

  TEST_ADDRESS_REPOSITORY = new AddressRepository(mongoConnection, logger);
  TEST_DISPLAY_NAME_REPOSITORY = new DisplayNameRepository(mongoConnection, logger);
  TEST_IDENTIFIER_REPOSITORY = new IdentifierRepository(mongoConnection, logger);
  TEST_IDENTITY_REPOSITORY = new IdentityRepository(mongoConnection, logger);

  const keyPairCache = new KeyPairMemoryCache(memoryDatabase, logger);
  await keyPairCache.create(createTestKeyPair());
};
