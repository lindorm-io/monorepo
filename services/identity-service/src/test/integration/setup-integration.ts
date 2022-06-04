import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { mongoConnection, redisConnection } from "../../instance";
import {
  ConnectSessionCache,
  DisplayNameRepository,
  EmailRepository,
  IdentityRepository,
  ExternalIdentifierRepository,
  PhoneNumberRepository,
} from "../../infrastructure";

export let TEST_CONNECT_SESSION_CACHE: ConnectSessionCache;

export let TEST_DISPLAY_NAME_REPOSITORY: DisplayNameRepository;
export let TEST_EMAIL_REPOSITORY: EmailRepository;
export let TEST_IDENTITY_REPOSITORY: IdentityRepository;
export let TEST_EXTERNAL_IDENTIFIER_REPOSITORY: ExternalIdentifierRepository;
export let TEST_PHONE_NUMBER_REPOSITORY: PhoneNumberRepository;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  TEST_CONNECT_SESSION_CACHE = new ConnectSessionCache({ connection: redisConnection, logger });

  TEST_DISPLAY_NAME_REPOSITORY = new DisplayNameRepository({ connection: mongoConnection, logger });
  TEST_EMAIL_REPOSITORY = new EmailRepository({ connection: mongoConnection, logger });
  TEST_IDENTITY_REPOSITORY = new IdentityRepository({ connection: mongoConnection, logger });
  TEST_EXTERNAL_IDENTIFIER_REPOSITORY = new ExternalIdentifierRepository({
    connection: mongoConnection,
    logger,
  });
  TEST_PHONE_NUMBER_REPOSITORY = new PhoneNumberRepository({ connection: mongoConnection, logger });

  const keyPairCache = new KeyPairCache({
    connection: redisConnection,
    logger,
  });
  await keyPairCache.create(createTestKeyPair());
};
