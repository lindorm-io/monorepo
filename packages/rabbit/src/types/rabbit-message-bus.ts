import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";

export type RabbitBusOptions<M extends IMessage> = {
  Message: Constructor<M>;
  channel: ConfirmChannel;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  nackTimeout: number;
  subscriptions: IMessageSubscriptions;
};
