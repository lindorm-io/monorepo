import type { IMessage } from "./Message.js";
import type { PublishOptions, SubscribeOptions } from "../types/index.js";

export interface IIrisMessageBus<M extends IMessage = IMessage> {
  create(options?: Partial<M>): M;
  hydrate(data: Record<string, unknown>): M;
  copy(message: M): M;
  validate(message: M): void;
  publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
  subscribe(options: SubscribeOptions<M> | Array<SubscribeOptions<M>>): Promise<void>;
  unsubscribe(options: { topic: string; queue?: string }): Promise<void>;
  unsubscribeAll(): Promise<void>;
}
