import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { logger } from "../logger";
import { redisConnection } from "../../instance";
import {
  ChallengeSessionCache,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../../infrastructure";

interface TestCache {
  challengeSessionCache: ChallengeSessionCache;
  enrolmentSessionCache: EnrolmentSessionCache;
  rdcSessionCache: RdcSessionCache;
  keyPairCache: KeyPairCache;
}

export const getTestCache = (): TestCache => ({
  challengeSessionCache: new ChallengeSessionCache({ connection: redisConnection, logger }),
  enrolmentSessionCache: new EnrolmentSessionCache({ connection: redisConnection, logger }),
  rdcSessionCache: new RdcSessionCache({
    connection: redisConnection,
    logger,
  }),
  keyPairCache: new KeyPairCache({ connection: redisConnection, logger }),
});
