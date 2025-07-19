import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { RedisDelayService } from "../../classes/private";
import { IRedisMessageBus } from "../../interfaces";

export type FromClone = {
  _mode: "from_clone";
  cache: Map<Constructor<IMessage>, IRedisMessageBus<IMessage>>;
  client: Redis;
  delayService: RedisDelayService;
  entities: Array<Constructor<IEntity>>;
  logger: ILogger;
  messages: Array<Constructor<IMessage>>;
  namespace?: string;
  subscriptions: IMessageSubscriptions;
};
