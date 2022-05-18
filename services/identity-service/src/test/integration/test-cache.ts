import { ConnectSessionCache } from "../../infrastructure";
import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { logger } from "../logger";
import { redisConnection } from "../../instance";

interface TestCache {
  connectSessionCache: ConnectSessionCache;
  keyPairCache: KeyPairCache;
}

export const getTestCache = (): TestCache => ({
  connectSessionCache: new ConnectSessionCache({ connection: redisConnection, logger }),
  keyPairCache: new KeyPairCache({ connection: redisConnection, logger }),
});
