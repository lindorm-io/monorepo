import { IMessage } from "../interfaces";

export type SubscribeOptions<M extends IMessage = IMessage> = {
  callback(message: M): Promise<void>;
  consumerTag?: string;
  topic: string;
  queue?: string;
};

export type FindSubscriptionFilter = {
  queue: string;
  topic: string;
};

export type RemoveSubscriptionFilter = {
  consumerTag: string;
};

export type UnsubscribeOptions = {
  topic: string;
  queue: string;
};
