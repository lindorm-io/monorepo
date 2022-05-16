import { RedisConnection } from "@lindorm-io/redis";
import { configuration } from "../server/configuration";
import { winston } from "../server/logger";

export const redisConnection = new RedisConnection({
  host: configuration.redis.host,
  port: configuration.redis.port,
  password: configuration.redis.password,
  winston,
});
