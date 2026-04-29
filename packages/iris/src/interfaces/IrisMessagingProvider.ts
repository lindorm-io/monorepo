import type { Constructor } from "@lindorm/types";
import type { IrisDriverType } from "../types/index.js";
import type { IIrisMessageBus } from "./IrisMessageBus.js";
import type { IIrisPublisher } from "./IrisPublisher.js";
import type { IIrisRpcClient } from "./IrisRpcClient.js";
import type { IIrisRpcServer } from "./IrisRpcServer.js";
import type { IIrisStreamProcessor } from "./IrisStreamProcessor.js";
import type { IIrisWorkerQueue } from "./IrisWorkerQueue.js";
import type { IMessage } from "./Message.js";

export interface IIrisMessagingProvider {
  readonly driver: IrisDriverType;

  hasMessage(target: Constructor<IMessage>): boolean;
  ping(): Promise<boolean>;

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
