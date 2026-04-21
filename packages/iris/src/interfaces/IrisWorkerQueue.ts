import type { IMessage } from "./Message.js";
import type { ConsumeEnvelope, ConsumeOptions, PublishOptions } from "../types/index.js";

export interface IIrisWorkerQueue<M extends IMessage = IMessage> {
  create(options?: Partial<M>): M;
  hydrate(data: Record<string, unknown>): M;
  copy(message: M): M;
  validate(message: M): void;
  publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
  consume(
    queue: string,
    callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<void>;
  consume(options: ConsumeOptions<M> | Array<ConsumeOptions<M>>): Promise<void>;
  unconsume(queue: string): Promise<void>;
  unconsumeAll(): Promise<void>;
}
