import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RedisSharedState, RedisConsumerLoop } from "../types/redis-types";
import { RedisRpcClient } from "./RedisRpcClient";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mocks ---
let mockCreateConsumerLoopResult: Partial<RedisConsumerLoop>;
const mockCreateConsumerLoop = vi
  .fn()
  .mockImplementation(async () => mockCreateConsumerLoopResult);
vi.mock("../utils/create-consumer-loop", async () => ({
  createConsumerLoop: (...args: Array<unknown>) => mockCreateConsumerLoop(...args),
}));

vi.mock("../utils/serialize-stream-fields", () => ({
  serializeStreamFields: vi
    .fn()
    .mockReturnValue(["payload", "dGVzdA==", "topic", "test"]),
}));

vi.mock("../utils/parse-stream-entry", () => ({
  parseStreamEntry: vi.fn(),
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
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockState = (): RedisSharedState => ({
  publishConnection: {
    xadd: vi.fn().mockResolvedValue("1-1"),
    duplicate: vi.fn().mockReturnValue({
      xreadgroup: vi.fn().mockResolvedValue(null),
      xack: vi.fn().mockResolvedValue(1),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    }),
    disconnect: vi.fn(),
    xgroup: vi.fn().mockResolvedValue("OK"),
    xreadgroup: vi.fn(),
    xack: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
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
    callback: vi.fn(),
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    connection: { disconnect: vi.fn() } as any,
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
    (state.publishConnection!.xadd as Mock).mockImplementation(async () => {
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
