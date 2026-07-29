import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Constructor } from "@lindorm/types";
import { vi, type Mocked } from "vitest";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisRpcClient,
  IIrisSession,
  IIrisSource,
  IIrisWorkerQueue,
  IMessage,
} from "../interfaces/index.js";
import type { CreateMockIrisSettings } from "./create-mock-iris-settings.js";
import { _createMockIrisSession } from "./create-mock-iris-session.js";
import { _createMockIrisSource } from "./create-mock-iris-source.js";
import { _createMockMessageBus } from "./create-mock-message-bus.js";
import { _createMockPublisher } from "./create-mock-publisher.js";
import { _createMockRpcClient } from "./create-mock-rpc-client.js";
import { _createMockWorkerQueue } from "./create-mock-worker-queue.js";

export type { CreateMockIrisSettings } from "./create-mock-iris-settings.js";

type MockIrisSource = Mocked<IIrisSource>;
type MockIrisSession = Mocked<IIrisSession>;
type MockMessageBus<M extends IMessage> = Mocked<IIrisMessageBus<M>>;
type MockPublisher<M extends IMessage> = Mocked<IIrisPublisher<M>>;
type MockWorkerQueue<M extends IMessage> = Mocked<IIrisWorkerQueue<M>>;
type MockRpcClient<Req extends IMessage, Res extends IMessage> = Mocked<
  IIrisRpcClient<Req, Res>
>;

export const createMockIrisSource = async (
  settings?: CreateMockIrisSettings,
): Promise<MockIrisSource> =>
  (await _createMockIrisSource(vi.fn, createMockLogger, settings)) as MockIrisSource;

export const createMockIrisSession = async (
  settings?: CreateMockIrisSettings,
): Promise<MockIrisSession> =>
  (await _createMockIrisSession(vi.fn, createMockLogger, settings)) as MockIrisSession;

export const createMockMessageBus = async <M extends IMessage = IMessage>(
  target: Constructor<M>,
  settings?: CreateMockIrisSettings,
): Promise<MockMessageBus<M>> =>
  (await _createMockMessageBus<M>(
    vi.fn,
    createMockLogger,
    target,
    settings,
  )) as MockMessageBus<M>;

export const createMockPublisher = async <M extends IMessage = IMessage>(
  target: Constructor<M>,
  settings?: CreateMockIrisSettings,
): Promise<MockPublisher<M>> =>
  (await _createMockPublisher<M>(
    vi.fn,
    createMockLogger,
    target,
    settings,
  )) as MockPublisher<M>;

export const createMockWorkerQueue = async <M extends IMessage = IMessage>(
  target: Constructor<M>,
  settings?: CreateMockIrisSettings,
): Promise<MockWorkerQueue<M>> =>
  (await _createMockWorkerQueue<M>(
    vi.fn,
    createMockLogger,
    target,
    settings,
  )) as MockWorkerQueue<M>;

export const createMockRpcClient = async <
  Req extends IMessage = IMessage,
  Res extends IMessage = IMessage,
>(
  requestTarget: Constructor<Req>,
  responseTarget: Constructor<Res>,
  responseFactory?: (request: Req) => Res | Promise<Res>,
  settings?: CreateMockIrisSettings,
): Promise<MockRpcClient<Req, Res>> =>
  (await _createMockRpcClient<Req, Res>(
    vi.fn,
    createMockLogger,
    requestTarget,
    responseTarget,
    responseFactory,
    settings,
  )) as MockRpcClient<Req, Res>;
