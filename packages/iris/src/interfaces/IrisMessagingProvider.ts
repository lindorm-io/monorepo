import type { Constructor } from "@lindorm/types";
import type { IrisDriverType } from "../types";
import type { IIrisMessageBus } from "./IrisMessageBus";
import type { IIrisPublisher } from "./IrisPublisher";
import type { IIrisRpcClient } from "./IrisRpcClient";
import type { IIrisRpcServer } from "./IrisRpcServer";
import type { IIrisStreamProcessor } from "./IrisStreamProcessor";
import type { IIrisWorkerQueue } from "./IrisWorkerQueue";
import type { IMessage } from "./Message";

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
