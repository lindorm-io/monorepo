import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { IMessage, MessageScannerInput } from "@lindorm/message";
import { RedisOptions } from "ioredis";

export type WithLoggerOptions = {
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
