import { createTestStoredKeySet } from "@lindorm-io/keystore";
import { StoredKeySetMemoryCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import {
  AddressRepository,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../../infrastructure";
import { memoryDatabase, mongoConnection } from "../../instance";

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

  const keyPairCache = new StoredKeySetMemoryCache(memoryDatabase, logger);
  await keyPairCache.create(createTestStoredKeySet());
};
