import { vi, type Mocked } from "vitest";
import type { IIrisMessageBus } from "../interfaces/IrisMessageBus.js";
import type { IIrisPublisher } from "../interfaces/IrisPublisher.js";
import type { IIrisRpcClient } from "../interfaces/IrisRpcClient.js";
import type { IIrisSession } from "../interfaces/IrisSession.js";
import type { IIrisSource } from "../interfaces/IrisSource.js";
import type { IIrisWorkerQueue } from "../interfaces/IrisWorkerQueue.js";
import type { IMessage } from "../interfaces/Message.js";
import {
  _createMockMessageBus,
  type MessageBusExtras,
} from "./create-mock-message-bus.js";
import { _createMockIrisSession } from "./create-mock-iris-session.js";
import { _createMockIrisSource } from "./create-mock-iris-source.js";
import { _createMockPublisher, type PublisherExtras } from "./create-mock-publisher.js";
import { _createMockRpcClient, type RpcClientExtras } from "./create-mock-rpc-client.js";
import {
  _createMockWorkerQueue,
  type WorkerQueueExtras,
} from "./create-mock-worker-queue.js";

type MockIrisSource = Mocked<IIrisSource>;
type MockIrisSession = Mocked<IIrisSession>;
type MockMessageBus<M extends IMessage> = Mocked<IIrisMessageBus<M>> &
  MessageBusExtras<M>;
type MockPublisher<M extends IMessage> = Mocked<IIrisPublisher<M>> & PublisherExtras<M>;
type MockWorkerQueue<M extends IMessage> = Mocked<IIrisWorkerQueue<M>> &
  WorkerQueueExtras<M>;
type MockRpcClient<Req extends IMessage, Res extends IMessage> = Mocked<
  IIrisRpcClient<Req, Res>
> &
  RpcClientExtras<Req>;

export const createMockIrisSource = (): MockIrisSource =>
  _createMockIrisSource(vi.fn) as MockIrisSource;

export const createMockIrisSession = (): MockIrisSession =>
  _createMockIrisSession(vi.fn) as MockIrisSession;

export const createMockMessageBus = <
  M extends IMessage = IMessage,
>(): MockMessageBus<M> => _createMockMessageBus<M>(vi.fn) as MockMessageBus<M>;

export const createMockPublisher = <M extends IMessage = IMessage>(): MockPublisher<M> =>
  _createMockPublisher<M>(vi.fn) as MockPublisher<M>;

export const createMockWorkerQueue = <
  M extends IMessage = IMessage,
>(): MockWorkerQueue<M> => _createMockWorkerQueue<M>(vi.fn) as MockWorkerQueue<M>;

export const createMockRpcClient = <
  Req extends IMessage = IMessage,
  Res extends IMessage = IMessage,
>(
  responseFactory?: (req: Req) => Res | Promise<Res>,
): MockRpcClient<Req, Res> =>
  _createMockRpcClient<Req, Res>(vi.fn, responseFactory) as MockRpcClient<Req, Res>;
