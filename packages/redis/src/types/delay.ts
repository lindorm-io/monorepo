import { ILogger } from "@lindorm/logger";
import Redis from "ioredis";

export type RedisDelayServiceOptions = {
  client: Redis;
  logger: ILogger;
};
