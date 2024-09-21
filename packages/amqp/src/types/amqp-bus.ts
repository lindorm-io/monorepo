import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";
import { SubscriptionList } from "../classes/private";
import { IAmqpMessage } from "../interfaces";
import { IAmqpSubscription } from "../interfaces/AmqpSubscription";

export type ValidateMessageFn<M extends IAmqpMessage = IAmqpMessage> = (
  message: Omit<M, "id" | "delay" | "mandatory" | "timestamp" | "topic" | "type">,
) => void;

export type SubscriptionData<
  M extends IAmqpMessage = IAmqpMessage,
  S extends IAmqpSubscription<M> = IAmqpSubscription<M>,
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

export type AmqpBusOptions<M extends IAmqpMessage> = {
  Message: Constructor<M>;
  channel: ConfirmChannel;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  nackTimeout: number;
  subscriptions: SubscriptionList;
  validate?: ValidateMessageFn<M>;
};
