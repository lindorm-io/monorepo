import { IMessage } from "./message";

export interface ISubscription {
  callback(message: IMessage): Promise<void>;
  queue: string;
  topic: string;
}
