import type { Constructor } from "@lindorm/types";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisRpcClient,
  IIrisRpcServer,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
} from "../../../interfaces/index.js";
import type { DeadLetterEntry } from "../../../types/dead-letter.js";

export type TckCapabilities = {
  // ─── Always-on (tested unconditionally) ──────────────────────────────────────
  // publish/subscribe, fan-out, topic resolution, hooks

  // ─── Gated capabilities ──────────────────────────────────────────────────────

  /** Competing-consumer worker queue */
  workerQueue: boolean;
  /** RPC request/response */
  rpc: boolean;
  /** Stream processor/pipeline */
  stream: boolean;
  /** Delayed publish */
  delay: boolean;
  /** Retry with backoff */
  retry: boolean;
  /** Dead letter queue */
  deadLetter: boolean;
  /** Broadcast to all consumers */
  broadcast: boolean;
  /** Encryption via @Encrypted + Amphora */
  encryption: boolean;
  /** Compression via @Compressed */
  compression: boolean;
};

export type TckDriverHandle = {
  messageBus<M extends IMessage>(target: Constructor<M>): IIrisMessageBus<M>;
  publisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M>;
  workerQueue<M extends IMessage>(target: Constructor<M>): IIrisWorkerQueue<M>;
  stream(): IIrisStreamProcessor;
  rpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcClient<Req, Res>;
  rpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcServer<Req, Res>;
  getDeadLetters(topic?: string): Promise<Array<DeadLetterEntry>>;
  clear(): Promise<void>;
  teardown(): Promise<void>;
};

export type TckDriverFactory = {
  driver: string;
  capabilities: TckCapabilities;
  /** Max time in ms to wait for message delivery via waitFor(). Default: 10000. */
  timeoutMs?: number;
  setup(messages: Array<Constructor<IMessage>>): Promise<TckDriverHandle>;
};
