import { ConnectSessionCache } from "../../infrastructure";
import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../../instance";
import { logger } from "../logger";

interface TestCache {
  connectSessionCache: ConnectSessionCache;
  keyPairCache: KeyPairCache;
}

export const getTestCache = async (): Promise<TestCache> => {
  await redisConnection.waitForConnection();
  const client = redisConnection.client();

  return {
    connectSessionCache: new ConnectSessionCache({ client, logger }),
    keyPairCache: new KeyPairCache({ client, logger }),
  };
};
