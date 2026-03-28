import type { IMessage } from "./Message";

export interface IMessageSubscriber {
  beforePublish?(message: IMessage): void | Promise<void>;
  afterPublish?(message: IMessage): void | Promise<void>;
  beforeConsume?(message: IMessage): void | Promise<void>;
  afterConsume?(message: IMessage): void | Promise<void>;
  onConsumeError?(error: Error, message: IMessage): void | Promise<void>;
}
