import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";

export type RedisMessageBusOptions<M extends IMessage> = {
  Message: Constructor<M>;
  client: Redis;
  logger: ILogger;
  subscriptions: IMessageSubscriptions;
};
