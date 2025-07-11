import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { IMessage, MessageScannerInput } from "@lindorm/message";
import { RedisOptions } from "ioredis";

export type RedisSourceMessageBusOptions = {
  logger?: ILogger;
};

export type RedisSourceRepositoryOptions = {
  logger?: ILogger;
};

export type CloneRedisSourceOptions = {
  logger?: ILogger;
};

export type RedisSourceOptions = {
  config?: RedisOptions;
  entities?: EntityScannerInput<IEntity>;
  messages?: MessageScannerInput<IMessage>;
  logger: ILogger;
  namespace?: string;
  url: string;
};
