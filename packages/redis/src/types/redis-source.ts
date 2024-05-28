import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { RedisOptions } from "ioredis";
import { IRedisEntity } from "../interfaces";

export type RedisSourceOptions = {
  config?: RedisOptions;
  entities: Array<Constructor<IRedisEntity> | string>;
  logger: ILogger;
  namespace?: string;
  url: string;
  useCache?: boolean;
};
