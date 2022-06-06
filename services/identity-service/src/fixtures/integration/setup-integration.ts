import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { mongoConnection, redisConnection } from "../../instance";
import {
  AddressRepository,
  ConnectSessionCache,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../../infrastructure";

export let TEST_CONNECT_SESSION_CACHE: ConnectSessionCache;

export let TEST_ADDRESS_REPOSITORY: AddressRepository;
export let TEST_DISPLAY_NAME_REPOSITORY: DisplayNameRepository;
export let TEST_IDENTIFIER_REPOSITORY: IdentifierRepository;
export let TEST_IDENTITY_REPOSITORY: IdentityRepository;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  TEST_CONNECT_SESSION_CACHE = new ConnectSessionCache({ connection: redisConnection, logger });

  TEST_ADDRESS_REPOSITORY = new AddressRepository({ connection: mongoConnection, logger });
  TEST_DISPLAY_NAME_REPOSITORY = new DisplayNameRepository({ connection: mongoConnection, logger });
  TEST_IDENTIFIER_REPOSITORY = new IdentifierRepository({ connection: mongoConnection, logger });
  TEST_IDENTITY_REPOSITORY = new IdentityRepository({ connection: mongoConnection, logger });

  const keyPairCache = new KeyPairCache({
    connection: redisConnection,
    logger,
  });
  await keyPairCache.create(createTestKeyPair());
};
