import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../../instance";
import { winston } from "../../logger";
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

export const getTestCache = async (): Promise<TestCache> => {
  await redisConnection.waitForConnection();
  const client = redisConnection.client();
  const logger = winston;

  return {
    challengeSessionCache: new ChallengeSessionCache({ client, logger }),
    enrolmentSessionCache: new EnrolmentSessionCache({ client, logger }),
    rdcSessionCache: new RdcSessionCache({
      client,
      logger,
    }),
    keyPairCache: new KeyPairCache({ client, logger }),
  };
};
