import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RedisSharedState, RedisConsumerLoop } from "../types/redis-types";
import { RedisRpcClient } from "./RedisRpcClient";

// --- Mocks ---
let mockCreateConsumerLoopResult: Partial<RedisConsumerLoop>;
const mockCreateConsumerLoop = jest
  .fn()
  .mockImplementation(async () => mockCreateConsumerLoopResult);
jest.mock("../utils/create-consumer-loop", () => ({
  createConsumerLoop: (...args: Array<unknown>) => mockCreateConsumerLoop(...args),
}));

jest.mock("../utils/serialize-stream-fields", () => ({
  serializeStreamFields: jest
    .fn()
    .mockReturnValue(["payload", "dGVzdA==", "topic", "test"]),
}));

jest.mock("../utils/parse-stream-entry", () => ({
  parseStreamEntry: jest.fn(),
}));

// --- Test messages ---

@Message({ name: "TckRedisRpcReq" })
class TckRedisRpcReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckRedisRpcRes" })
class TckRedisRpcRes implements IMessage {
  @Field("string") result!: string;
}

// --- Helpers ---

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createMockState = (): RedisSharedState => ({
  publishConnection: {
    xadd: jest.fn().mockResolvedValue("1-1"),
    duplicate: jest.fn().mockReturnValue({
      xreadgroup: jest.fn().mockResolvedValue(null),
      xack: jest.fn().mockResolvedValue(1),
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    }),
    disconnect: jest.fn(),
    xgroup: jest.fn().mockResolvedValue("OK"),
    xreadgroup: jest.fn(),
    xack: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  } as any,
  connectionConfig: { url: "redis://localhost:6379" },
  prefix: "iris",
  consumerName: "iris:test:1:abcd1234",
  consumerLoops: [],
  consumerRegistrations: [],
  createdGroups: new Set(),
  publishedStreams: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  blockMs: 5000,
  maxStreamLength: null,
});

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockCreateConsumerLoop.mockClear();
  mockCreateConsumerLoopResult = {
    consumerTag: "reply-ctag",
    groupName: "reply-group",
    streamKey: "iris:rpc:reply:test",
    callback: jest.fn(),
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    connection: { disconnect: jest.fn() } as any,
  };
});

describe("RedisRpcClient", () => {
  it("should create a client instance", () => {
    const state = createMockState();
    const client = new RedisRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcReq as any,
      responseTarget: TckRedisRpcRes as any,
    });
    expect(client).toBeDefined();
  });

  it("should throw when connection is not available", async () => {
    const state = createMockState();
    state.publishConnection = null;

    const client = new RedisRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcReq as any,
      responseTarget: TckRedisRpcRes as any,
    });

    const msg = { query: "test" } as any;
    await expect(client.request(msg, { timeout: 100 })).rejects.toThrow(
      "Cannot send RPC request: connection is not available",
    );
  });

  it("should reject pending requests on close", async () => {
    const state = createMockState();
    const client = new RedisRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcReq as any,
      responseTarget: TckRedisRpcRes as any,
    });

    // Start a request that won't resolve — don't await, it's pending
    const requestPromise = client.request({ query: "test" } as any, { timeout: 60000 });

    // Give the async request() time to publish and create the pending promise
    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    // Close the client — should reject the pending request
    await client.close();

    await expect(requestPromise).rejects.toThrow(
      "RPC client closed while request was pending",
    );
  }, 10000);

  it("should start reply consumer on first request", async () => {
    const state = createMockState();
    const client = new RedisRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcReq as any,
      responseTarget: TckRedisRpcRes as any,
    });

    // Start request (will timeout, but that's ok for this test)
    const requestPromise = client.request({ query: "test" } as any, { timeout: 100 });

    expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(1);

    // Cleanup
    await client.close();
    await requestPromise.catch(() => {});
  });

  it("should clean up reply stream and consumer group on close", async () => {
    const state = createMockState();
    const client = new RedisRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcReq as any,
      responseTarget: TckRedisRpcRes as any,
    });

    // Start a request so reply consumer is created
    const requestPromise = client.request({ query: "test" } as any, { timeout: 60000 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    await client.close();
    await requestPromise.catch(() => {});

    // I4: should destroy the consumer group and delete the stream
    expect(state.publishConnection!.xgroup).toHaveBeenCalledWith(
      "DESTROY",
      expect.stringMatching(/^iris:rpc:reply:/),
      expect.stringMatching(/^iris\.rpc\.reply\./),
    );
    expect(state.publishConnection!.del).toHaveBeenCalledWith(
      expect.stringMatching(/^iris:rpc:reply:/),
    );
  }, 10000);

  it("should register pending request before publishing to stream", async () => {
    const state = createMockState();
    const callOrder: Array<string> = [];

    // Track order: xadd is the publish call
    (state.publishConnection!.xadd as jest.Mock).mockImplementation(async () => {
      callOrder.push("xadd");
      return "1-1";
    });

    const client = new RedisRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcReq as any,
      responseTarget: TckRedisRpcRes as any,
    });

    // Spy on registerPendingRequest via the pendingRequests map
    const origSet = client["pendingRequests"].set.bind(client["pendingRequests"]);
    client["pendingRequests"].set = (...args: [string, any]) => {
      callOrder.push("register");
      return origSet(...args);
    };

    const requestPromise = client.request({ query: "test" } as any, { timeout: 60000 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    // register must happen before xadd
    expect(callOrder.indexOf("register")).toBeLessThan(callOrder.indexOf("xadd"));

    await client.close();
    await requestPromise.catch(() => {});
  }, 10000);

  it("should not start multiple reply consumers on concurrent requests (I8)", async () => {
    const state = createMockState();
    const client = new RedisRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcReq as any,
      responseTarget: TckRedisRpcRes as any,
    });

    // Fire two concurrent requests
    const p1 = client.request({ query: "a" } as any, { timeout: 100 });
    const p2 = client.request({ query: "b" } as any, { timeout: 100 });

    // Only one consumer loop should be created despite concurrent calls
    expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(1);

    // Cleanup
    await client.close();
    await p1.catch(() => {});
    await p2.catch(() => {});
  });
});
