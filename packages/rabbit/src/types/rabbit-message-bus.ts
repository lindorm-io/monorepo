import { ILogger } from "@lindorm/logger";
import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";
import { SubscriptionList } from "../classes/private";
import { IRabbitSubscription } from "../interfaces";

export type RabbitSubscriptionItem<
  M extends IMessage = IMessage,
  S extends IRabbitSubscription<M> = IRabbitSubscription<M>,
> = {
  Message: Constructor<M>;
  consumerTag: string;
  subscription: S;
};

export type UnsubscribeOptions = {
  queue: string;
  topic: string;
};

export type RabbitBusOptions<M extends IMessage> = {
  Message: Constructor<M>;
  channel: ConfirmChannel;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  nackTimeout: number;
  subscriptions: SubscriptionList;
};
