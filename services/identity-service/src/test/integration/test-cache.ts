import { ConnectSessionCache } from "../../infrastructure";
import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../../instance";
import { winston } from "../../logger";

interface TestCache {
  connectSessionCache: ConnectSessionCache;
  keyPairCache: KeyPairCache;
}

export const getTestCache = async (): Promise<TestCache> => {
  await redisConnection.waitForConnection();
  const client = redisConnection.client();
  const logger = winston;

  return {
    connectSessionCache: new ConnectSessionCache({ client, logger }),
    keyPairCache: new KeyPairCache({ client, logger }),
  };
};
