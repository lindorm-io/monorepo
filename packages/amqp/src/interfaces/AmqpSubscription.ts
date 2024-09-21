import { IAmqpMessage } from "./AmqpMessage";

export interface IAmqpSubscription<M extends IAmqpMessage> {
  callback(message: M): Promise<void>;
  queue: string;
  topic: string;
}
