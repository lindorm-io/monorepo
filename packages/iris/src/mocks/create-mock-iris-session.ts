import type { IIrisSession } from "../interfaces";
import { createMockMessageBus } from "./create-mock-message-bus";
import { createMockPublisher } from "./create-mock-publisher";
import { createMockRpcClient } from "./create-mock-rpc-client";
import { createMockWorkerQueue } from "./create-mock-worker-queue";

export type MockIrisSession = jest.Mocked<IIrisSession>;

export const createMockIrisSession = (): MockIrisSession => ({
  driver: "memory" as const,

  hasMessage: jest.fn().mockReturnValue(true),
  ping: jest.fn().mockResolvedValue(true),

  messageBus: jest.fn().mockImplementation(() => createMockMessageBus()),
  publisher: jest.fn().mockImplementation(() => createMockPublisher()),
  workerQueue: jest.fn().mockImplementation(() => createMockWorkerQueue()),
  stream: jest.fn(),
  rpcClient: jest.fn().mockImplementation(() => createMockRpcClient()),
  rpcServer: jest.fn(),
});
