import { createTestKeyPair } from "@lindorm-io/key-pair";
import { KeyPairMemoryCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import {
  ChallengeSessionCache,
  ClientRepository,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  PublicKeyRepository,
  RdcSessionCache,
} from "../../infrastructure";
import { memoryDatabase, mongoConnection, redisConnection } from "../../instance";

export let TEST_CHALLENGE_SESSION_CACHE: ChallengeSessionCache;
export let TEST_ENROLMENT_SESSION_CACHE: EnrolmentSessionCache;
export let TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE: RdcSessionCache;

export let TEST_CLIENT_REPOSITORY: ClientRepository;
export let TEST_DEVICE_LINK_REPOSITORY: DeviceLinkRepository;
export let TEST_PUBLIC_KEY_REPOSITORY: PublicKeyRepository;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();
  await redisConnection.connect();

  TEST_CHALLENGE_SESSION_CACHE = new ChallengeSessionCache(redisConnection, logger);
  TEST_ENROLMENT_SESSION_CACHE = new EnrolmentSessionCache(redisConnection, logger);
  TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE = new RdcSessionCache(redisConnection, logger);

  TEST_CLIENT_REPOSITORY = new ClientRepository(mongoConnection, logger);
  TEST_DEVICE_LINK_REPOSITORY = new DeviceLinkRepository(mongoConnection, logger);
  TEST_PUBLIC_KEY_REPOSITORY = new PublicKeyRepository(mongoConnection, logger);

  const keyPairCache = new KeyPairMemoryCache(memoryDatabase, logger);
  await keyPairCache.create(createTestKeyPair());
};
