import type { Constructor } from "@lindorm/types";
import type { IIrisSource, IMessage } from "../interfaces";
import type { IrisConnectionState } from "../types";
import { createMockMessageBus } from "./create-mock-message-bus";
import { createMockPublisher } from "./create-mock-publisher";
import { createMockRpcClient } from "./create-mock-rpc-client";
import { createMockWorkerQueue } from "./create-mock-worker-queue";

export const createMockIrisSource = (): IIrisSource => ({
  driver: "memory" as const,
  messages: [] as ReadonlyArray<Constructor<IMessage>>,

  addMessages: jest.fn(),
  hasMessage: jest.fn().mockReturnValue(true),
  addSubscriber: jest.fn(),
  removeSubscriber: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockIrisSource()),

  connect: jest.fn(),
  disconnect: jest.fn(),
  drain: jest.fn(),
  ping: jest.fn().mockResolvedValue(true),
  setup: jest.fn(),
  getConnectionState: jest.fn().mockReturnValue("connected" as IrisConnectionState),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),

  messageBus: jest.fn().mockImplementation(() => createMockMessageBus()),
  publisher: jest.fn().mockImplementation(() => createMockPublisher()),
  workerQueue: jest.fn().mockImplementation(() => createMockWorkerQueue()),
  stream: jest.fn(),
  rpcClient: jest.fn().mockImplementation(() => createMockRpcClient()),
  rpcServer: jest.fn(),
});
