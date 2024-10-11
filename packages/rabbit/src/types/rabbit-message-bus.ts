import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";
import { SubscriptionList } from "../classes/private";
import { IRabbitMessage, IRabbitSubscription } from "../interfaces";

export type CreateRabbitMessageFn<M extends IRabbitMessage = IRabbitMessage> = (
  options: DeepPartial<M>,
) => M;

export type ValidateRabbitMessageFn<M extends IRabbitMessage = IRabbitMessage> = (
  message: Omit<M, "id" | "delay" | "mandatory" | "timestamp" | "topic" | "type">,
) => void;

export type RabbitSubscriptionItem<
  M extends IRabbitMessage = IRabbitMessage,
  S extends IRabbitSubscription<M> = IRabbitSubscription<M>,
> = {
  queue: string;
  topic: string;
  consumerTag: string;
  subscription: S;
};

export type UnsubscribeOptions = {
  queue: string;
  topic: string;
};

export type RabbitBusOptions<M extends IRabbitMessage> = {
  Message: Constructor<M>;
  channel: ConfirmChannel;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  nackTimeout: number;
  subscriptions: SubscriptionList;
  create?: CreateRabbitMessageFn<M>;
  validate?: ValidateRabbitMessageFn<M>;
};
