import type { IMessage } from "./Message.js";
import type { PublishOptions } from "../types/index.js";

export interface IIrisPublisher<M extends IMessage = IMessage> {
  create(options?: Partial<M>): M;
  hydrate(data: Record<string, unknown>): M;
  copy(message: M): M;
  validate(message: M): void;
  publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
}
