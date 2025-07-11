import { Constructor } from "@lindorm/types";
import { IMessage } from "./Message";

export interface IMessageSubscription<M extends IMessage = IMessage> {
  callback(message: M): Promise<void>;
  consumerTag: string;
  queue: string;
  target: Constructor<M>;
  topic: string;
}
