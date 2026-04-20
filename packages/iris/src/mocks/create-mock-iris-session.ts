import type { IIrisSession } from "../interfaces";
import { _createMockMessageBus } from "./create-mock-message-bus";
import { _createMockPublisher } from "./create-mock-publisher";
import { _createMockRpcClient } from "./create-mock-rpc-client";
import { _createMockWorkerQueue } from "./create-mock-worker-queue";

export const _createMockIrisSession = (mockFn: () => any): IIrisSession => {
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const returns = (value: any) => {
    const m = mockFn();
    m.mockReturnValue(value);
    return m;
  };
  const resolves = (value: any) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  return {
    driver: "memory" as const,

    hasMessage: returns(true),
    ping: resolves(true),

    messageBus: impl(() => _createMockMessageBus(mockFn)),
    publisher: impl(() => _createMockPublisher(mockFn)),
    workerQueue: impl(() => _createMockWorkerQueue(mockFn)),
    stream: mockFn(),
    rpcClient: impl(() => _createMockRpcClient(mockFn)),
    rpcServer: mockFn(),
  } as unknown as IIrisSession;
};
