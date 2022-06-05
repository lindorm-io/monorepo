import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { mongoConnection, redisConnection } from "../../instance";
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

  TEST_CHALLENGE_SESSION_CACHE = new ChallengeSessionCache({ connection: redisConnection, logger });
  TEST_ENROLMENT_SESSION_CACHE = new EnrolmentSessionCache({ connection: redisConnection, logger });
  TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE = new RdcSessionCache({
    connection: redisConnection,
    logger,
  });

  TEST_DEVICE_REPOSITORY = new DeviceLinkRepository({ connection: mongoConnection, logger });

  const keyPairCache = new KeyPairCache({
    connection: redisConnection,
    logger,
  });
  await keyPairCache.create(createTestKeyPair());
};
