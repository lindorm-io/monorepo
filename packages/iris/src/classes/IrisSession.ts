import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisDriver } from "../interfaces/IrisDriver";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisRpcClient,
  IIrisRpcServer,
  IIrisSession,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
} from "../interfaces";
import type { IrisDriverType } from "../types";

export type IrisSessionOptions = {
  logger: ILogger;
  context: unknown;
  driver: IIrisDriver;
  driverType: IrisDriverType;
  messages: Array<Constructor<IMessage>>;
};

export class IrisSession implements IIrisSession {
  private readonly _driver: IIrisDriver;
  private readonly _driverType: IrisDriverType;
  private readonly _messages: Array<Constructor<IMessage>>;

  public constructor(options: IrisSessionOptions) {
    this._driver = options.driver;
    this._driverType = options.driverType;
    this._messages = options.messages;
  }

  // --- Data-access getters ---

  public get driver(): IrisDriverType {
    return this._driverType;
  }

  // --- Data-access methods ---

  public hasMessage(target: Constructor<IMessage>): boolean {
    return this._messages.includes(target);
  }

  public async ping(): Promise<boolean> {
    return this._driver.ping();
  }

  public messageBus<M extends IMessage>(target: Constructor<M>): IIrisMessageBus<M> {
    return this._driver.createMessageBus(target);
  }

  public publisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M> {
    return this._driver.createPublisher(target);
  }

  public workerQueue<M extends IMessage>(target: Constructor<M>): IIrisWorkerQueue<M> {
    return this._driver.createWorkerQueue(target);
  }

  public stream(): IIrisStreamProcessor {
    return this._driver.createStreamProcessor();
  }

  public rpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcClient<Req, Res> {
    return this._driver.createRpcClient(requestTarget, responseTarget);
  }

  public rpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcServer<Req, Res> {
    return this._driver.createRpcServer(requestTarget, responseTarget);
  }
}
