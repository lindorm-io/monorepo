import { ILogger } from "@lindorm/logger";
import { Redis } from "ioredis";
import { RedisSourceEntity } from "../redis-source";

export type FromClone = {
  _mode: "from_clone";
  client: Redis;
  entities: Array<RedisSourceEntity>;
  logger: ILogger;
  namespace: string | undefined;
};
