import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { RedisSharedState, RedisConsumerLoop } from "../types/redis-types.js";
import { RedisRpcServer } from "./RedisRpcServer.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---
let mockCreateConsumerLoopResult: Partial<RedisConsumerLoop>;
const mockCreateConsumerLoop = vi
  .fn()
  .mockImplementation(async () => mockCreateConsumerLoopResult);
vi.mock("../utils/create-consumer-loop.js", async () => ({
  createConsumerLoop: (...args: Array<unknown>) => mockCreateConsumerLoop(...args),
}));

vi.mock("../utils/serialize-stream-fields.js", () => ({
  serializeStreamFields: vi
    .fn()
    .mockReturnValue(["payload", "dGVzdA==", "topic", "test"]),
}));

// --- Test messages ---

@Message({ name: "TckRedisRpcSrvReq" })
class TckRedisRpcSrvReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckRedisRpcSrvRes" })
class TckRedisRpcSrvRes implements IMessage {
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
    consumerTag: "srv-ctag",
    groupName: "iris.rpc.TckRedisRpcSrvReq",
    streamKey: "iris:rpc:TckRedisRpcSrvReq",
    callback: vi.fn(),
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    connection: { disconnect: vi.fn() } as any,
  };
});

describe("RedisRpcServer", () => {
  it("should register handler via serve()", async () => {
    const state = createMockState();
    const server = new RedisRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcSrvReq as any,
      responseTarget: TckRedisRpcSrvRes as any,
    });

    await server.serve(async (req: any) => ({ result: req.query }) as any);

    expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(1);
    const loopOpts = mockCreateConsumerLoop.mock.calls[0][0];
    expect(loopOpts.streamKey).toBe("iris:rpc:TckRedisRpcSrvReq");
  });

  it("should throw when handler already registered for queue", async () => {
    const state = createMockState();
    const server = new RedisRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcSrvReq as any,
      responseTarget: TckRedisRpcSrvRes as any,
    });

    await server.serve(async (req) => ({ result: "a" }) as any);

    await expect(server.serve(async (req) => ({ result: "b" }) as any)).rejects.toThrow(
      "RPC handler already registered",
    );
  });

  it("should throw when connection is not available", async () => {
    const state = createMockState();
    state.publishConnection = null;

    const server = new RedisRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckRedisRpcSrvReq as any,
      responseTarget: TckRedisRpcSrvRes as any,
    });

    await expect(server.serve(async () => ({ result: "x" }) as any)).rejects.toThrow(
      "Cannot serve RPC: connection is not available",
    );
  });

  describe("unserve", () => {
    it("should abort consumer loop on unserve", async () => {
      const ac = new AbortController();
      const dc = vi.fn().mockResolvedValue(undefined);
      mockCreateConsumerLoopResult = {
        consumerTag: "srv-ctag-2",
        groupName: "iris.rpc.TckRedisRpcSrvReq",
        streamKey: "iris:rpc:TckRedisRpcSrvReq",
        callback: vi.fn(),
        abortController: ac,
        loopPromise: Promise.resolve(),
        connection: { disconnect: dc } as any,
      };

      const state = createMockState();
      const server = new RedisRpcServer({
        state,
        logger: createMockLogger() as any,
        requestTarget: TckRedisRpcSrvReq as any,
        responseTarget: TckRedisRpcSrvRes as any,
      });

      await server.serve(async () => ({ result: "x" }) as any);

      await server.unserve();

      expect(ac.signal.aborted).toBe(true);
      expect(dc).toHaveBeenCalledTimes(1);
    });
  });

  describe("unserveAll", () => {
    it("should abort all registered handlers", async () => {
      const ac = new AbortController();
      const dc = vi.fn().mockResolvedValue(undefined);
      mockCreateConsumerLoopResult = {
        consumerTag: "srv-ctag-3",
        groupName: "iris.rpc.TckRedisRpcSrvReq",
        streamKey: "iris:rpc:TckRedisRpcSrvReq",
        callback: vi.fn(),
        abortController: ac,
        loopPromise: Promise.resolve(),
        connection: { disconnect: dc } as any,
      };

      const state = createMockState();
      const server = new RedisRpcServer({
        state,
        logger: createMockLogger() as any,
        requestTarget: TckRedisRpcSrvReq as any,
        responseTarget: TckRedisRpcSrvRes as any,
      });

      await server.serve(async () => ({ result: "x" }) as any);

      await server.unserveAll();

      expect(ac.signal.aborted).toBe(true);
    });
  });
});
