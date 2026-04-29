import type { Constructor } from "@lindorm/types";
import type { IIrisSource, IMessage } from "../interfaces/index.js";
import type { IrisConnectionState } from "../types/index.js";
import { _createMockIrisSession } from "./create-mock-iris-session.js";
import { _createMockMessageBus } from "./create-mock-message-bus.js";
import { _createMockPublisher } from "./create-mock-publisher.js";
import { _createMockRpcClient } from "./create-mock-rpc-client.js";
import { _createMockWorkerQueue } from "./create-mock-worker-queue.js";

export const _createMockIrisSource = (mockFn: () => any): IIrisSource => {
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
    messages: [] as ReadonlyArray<Constructor<IMessage>>,

    addMessages: mockFn(),
    hasMessage: returns(true),
    addSubscriber: mockFn(),
    removeSubscriber: mockFn(),
    session: impl(() => _createMockIrisSession(mockFn)),

    connect: mockFn(),
    disconnect: mockFn(),
    drain: mockFn(),
    ping: resolves(true),
    setup: mockFn(),
    getConnectionState: returns("connected" as IrisConnectionState),
    on: mockFn(),
    off: mockFn(),
    once: mockFn(),

    messageBus: impl(() => _createMockMessageBus(mockFn)),
    publisher: impl(() => _createMockPublisher(mockFn)),
    workerQueue: impl(() => _createMockWorkerQueue(mockFn)),
    stream: mockFn(),
    rpcClient: impl(() => _createMockRpcClient(mockFn)),
    rpcServer: mockFn(),
  } as unknown as IIrisSource;
};
