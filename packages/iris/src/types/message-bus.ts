import type { IMessage } from "../interfaces/index.js";
import type { ConsumeEnvelope } from "./consume-envelope.js";

export type SubscribeOptions<M extends IMessage = IMessage> = {
  topic: string;
  queue?: string;
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>;
  prefetch?: number;
};

export type ConsumeOptions<M extends IMessage = IMessage> = {
  queue: string;
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>;
  prefetch?: number;
};

export type PublishOptions = {
  delay?: number;
  priority?: number;
  expiry?: number;
  key?: string;
  headers?: Record<string, string>;
};
