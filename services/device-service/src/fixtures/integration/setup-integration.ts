import { KeyPairMemoryCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { memoryDatabase, mongoConnection, redisConnection } from "../../instance";
import {
  ChallengeSessionCache,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../../infrastructure";

export let TEST_CHALLENGE_SESSION_CACHE: ChallengeSessionCache;
export let TEST_ENROLMENT_SESSION_CACHE: EnrolmentSessionCache;
export let TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE: RdcSessionCache;

export let TEST_DEVICE_REPOSITORY: DeviceLinkRepository;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();
  await redisConnection.connect();

  TEST_CHALLENGE_SESSION_CACHE = new ChallengeSessionCache(redisConnection, logger);
  TEST_ENROLMENT_SESSION_CACHE = new EnrolmentSessionCache(redisConnection, logger);
  TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE = new RdcSessionCache(redisConnection, logger);

  TEST_DEVICE_REPOSITORY = new DeviceLinkRepository(mongoConnection, logger);

  const keyPairCache = new KeyPairMemoryCache(memoryDatabase, logger);
  await keyPairCache.create(createTestKeyPair());
};
