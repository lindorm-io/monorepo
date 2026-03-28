import type { Constructor } from "@lindorm/types";
import type {
  CloneOptions,
  IrisConnectionState,
  IrisDriverType,
  MessageScannerInput,
} from "../types";
import type { IIrisMessageBus } from "./IrisMessageBus";
import type { IIrisPublisher } from "./IrisPublisher";
import type { IIrisRpcClient } from "./IrisRpcClient";
import type { IIrisRpcServer } from "./IrisRpcServer";
import type { IIrisStreamProcessor } from "./IrisStreamProcessor";
import type { IIrisWorkerQueue } from "./IrisWorkerQueue";
import type { IMessage } from "./Message";
import type { IMessageSubscriber } from "./MessageSubscriber";

export interface IIrisSource {
  readonly driver: IrisDriverType;
  readonly messages: ReadonlyArray<Constructor<IMessage>>;

  addMessages(input: MessageScannerInput): void;
  hasMessage(target: Constructor<IMessage>): boolean;
  addSubscriber(subscriber: IMessageSubscriber): void;
  removeSubscriber(subscriber: IMessageSubscriber): void;
  clone(options?: CloneOptions): IIrisSource;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  drain(timeout?: number): Promise<void>;
  ping(): Promise<boolean>;
  setup(): Promise<void>;
  getConnectionState(): IrisConnectionState;
  onConnectionStateChange(callback: (state: IrisConnectionState) => void): void;

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
}
