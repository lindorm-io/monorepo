import type { Constructor } from "@lindorm/types";
import type { IrisConnectionState, IrisEvents } from "../types/index.js";
import type { IIrisMessageBus } from "./IrisMessageBus.js";
import type { IIrisPublisher } from "./IrisPublisher.js";
import type { IIrisRpcClient } from "./IrisRpcClient.js";
import type { IIrisRpcServer } from "./IrisRpcServer.js";
import type { IIrisStreamProcessor } from "./IrisStreamProcessor.js";
import type { IIrisWorkerQueue } from "./IrisWorkerQueue.js";
import type { IMessage } from "./Message.js";
import type { IMessageSubscriber } from "./MessageSubscriber.js";

export interface IIrisDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  drain(timeout?: number): Promise<void>;
  ping(): Promise<boolean>;
  setup(messages: Array<Constructor<IMessage>>): Promise<void>;

  getConnectionState(): IrisConnectionState;
  on<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void;
  off<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void;
  once<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void;

  createMessageBus<M extends IMessage>(target: Constructor<M>): IIrisMessageBus<M>;
  createPublisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M>;
  createWorkerQueue<M extends IMessage>(target: Constructor<M>): IIrisWorkerQueue<M>;
  createStreamProcessor(): IIrisStreamProcessor;
  createRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcClient<Req, Res>;
  createRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcServer<Req, Res>;

  cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver;
}
