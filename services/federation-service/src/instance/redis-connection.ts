import { RedisConnection } from "@lindorm-io/redis";
import { configuration } from "../server/configuration";
import { logger } from "../server/logger";

export const redisConnection = new RedisConnection(
  {
    host: configuration.redis.host,
    port: configuration.redis.port,
    username: configuration.redis.username,
    password: configuration.redis.password,
    namespace: configuration.redis.namespace,
  },
  logger,
);
