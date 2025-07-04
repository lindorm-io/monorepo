import { IMessage } from "@lindorm/message";

export interface IRabbitSubscription<M extends IMessage> {
  callback(message: M): Promise<void>;
  queue: string;
  topic: string;
}
