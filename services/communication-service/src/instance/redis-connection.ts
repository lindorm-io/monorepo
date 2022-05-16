import { RedisConnection } from "@lindorm-io/redis";
import { configuration, logger } from "../server";

export const redisConnection = new RedisConnection({
  host: configuration.redis.host,
  port: configuration.redis.port,
  password: configuration.redis.password,
  winston: logger,
});
