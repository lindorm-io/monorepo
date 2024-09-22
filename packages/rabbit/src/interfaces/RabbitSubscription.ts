import { IRabbitMessage } from "./RabbitMessage";

export interface IRabbitSubscription<M extends IRabbitMessage> {
  callback(message: M): Promise<void>;
  queue: string;
  topic: string;
}
