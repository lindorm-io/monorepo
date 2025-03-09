import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { RedisOptions } from "ioredis";

export type RedisSourceRepositoryOptions = {
  logger?: ILogger;
};

export type CloneRedisSourceOptions = {
  logger?: ILogger;
};

export type RedisSourceOptions = {
  config?: RedisOptions;
  entities?: EntityScannerInput<IEntity>;
  logger: ILogger;
  namespace?: string;
  url: string;
};
