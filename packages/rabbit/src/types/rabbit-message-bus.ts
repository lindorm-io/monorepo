import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";

export type RabbitMessageBusOptions<M extends IMessage> = {
  channel: ConfirmChannel;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  nackTimeout: number;
  subscriptions: IMessageSubscriptions;
  target: Constructor<M>;
};
