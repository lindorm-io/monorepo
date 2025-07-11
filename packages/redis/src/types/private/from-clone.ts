import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { DelayedMessageWorker, SubscriptionList } from "../../classes/private";

export type FromClone = {
  _mode: "from_clone";
  client: Redis;
  delayedMessageWorker: DelayedMessageWorker;
  entities: Array<Constructor<IEntity>>;
  logger: ILogger;
  messages: Array<Constructor<IMessage>>;
  namespace?: string;
  subscriptions: SubscriptionList;
};
