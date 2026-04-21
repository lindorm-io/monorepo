import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { NatsSharedState, NatsSubscription } from "../types/nats-types";
import { NatsRpcServer } from "./NatsRpcServer";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---
vi.mock("../utils/serialize-nats-message", async () => ({
  serializeNatsMessage: vi.fn().mockReturnValue({ data: new Uint8Array([1, 2, 3]) }),
}));

vi.mock("../utils/parse-nats-message", () => ({
  parseNatsMessage: vi.fn().mockReturnValue({
    payload: Buffer.from("{}"),
    headers: {},
    topic: "TckNatsRpcSrvReq",
    attempt: 0,
    maxRetries: 0,
    retryStrategy: "constant",
    retryDelay: 1000,
    retryDelayMax: 30000,
    retryMultiplier: 2,
    retryJitter: false,
    priority: 0,
    timestamp: 0,
    expiry: null,
    broadcast: false,
    replyTo: null,
    correlationId: "corr-1",
    identifierValue: null,
  }),
}));

// --- Test messages ---

@Message({ name: "TckNatsRpcSrvReq" })
class TckNatsRpcSrvReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckNatsRpcSrvRes" })
class TckNatsRpcSrvRes implements IMessage {
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

let mockSubscription: NatsSubscription;

const createMockState = (): NatsSharedState => {
  mockSubscription = {
    unsubscribe: vi.fn(),
    drain: vi.fn().mockResolvedValue(undefined),
    isClosed: false,
  };

  return {
    nc: {
      subscribe: vi.fn().mockReturnValue(mockSubscription),
      request: vi.fn(),
      jetstream: vi.fn(),
      jetstreamManager: vi.fn(),
      publish: vi.fn(),
      flush: vi.fn(),
      close: vi.fn(),
      drain: vi.fn(),
      status: vi.fn(),
      isClosed: vi.fn().mockReturnValue(false),
    } as any,
    js: {
      publish: vi
        .fn()
        .mockResolvedValue({ seq: 1, stream: "IRIS_IRIS", duplicate: false }),
      consumers: { get: vi.fn() },
    } as any,
    jsm: {
      streams: { info: vi.fn(), add: vi.fn(), purge: vi.fn() },
      consumers: {
        add: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue(true),
      },
    } as any,
    headersInit: vi.fn().mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
      values: vi.fn(),
    }) as any,
    prefix: "iris",
    streamName: "IRIS_IRIS",
    consumerLoops: [],
    consumerRegistrations: [],
    ensuredConsumers: new Set(),
    inFlightCount: 0,
    prefetch: 10,
  };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
});

describe("NatsRpcServer", () => {
  it("should register handler via serve()", async () => {
    const state = createMockState();
    const server = new NatsRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcSrvReq as any,
      responseTarget: TckNatsRpcSrvRes as any,
    });

    await server.serve(async (req: any) => ({ result: req.query }) as any);

    expect(state.nc!.subscribe).toHaveBeenCalledTimes(1);
    expect(state.nc!.subscribe).toHaveBeenCalledWith(
      "_rpc_.iris.TckNatsRpcSrvReq",
      expect.objectContaining({
        queue: "TckNatsRpcSrvReq",
        callback: expect.any(Function),
      }),
    );
  });

  it("should throw when handler already registered for queue", async () => {
    const state = createMockState();
    const server = new NatsRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcSrvReq as any,
      responseTarget: TckNatsRpcSrvRes as any,
    });

    await server.serve(async (req) => ({ result: "a" }) as any);

    await expect(server.serve(async (req) => ({ result: "b" }) as any)).rejects.toThrow(
      "RPC handler already registered",
    );
  });

  it("should throw when connection is not available", async () => {
    const state = createMockState();
    state.nc = null;

    const server = new NatsRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcSrvReq as any,
      responseTarget: TckNatsRpcSrvRes as any,
    });

    await expect(server.serve(async () => ({ result: "x" }) as any)).rejects.toThrow(
      "Cannot serve RPC: connection is not available",
    );
  });

  it("should throw when headersInit is not available", async () => {
    const state = createMockState();
    state.headersInit = null;

    const server = new NatsRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcSrvReq as any,
      responseTarget: TckNatsRpcSrvRes as any,
    });

    await expect(server.serve(async () => ({ result: "x" }) as any)).rejects.toThrow(
      "Cannot serve RPC: connection is not available",
    );
  });

  describe("unserve", () => {
    it("should unsubscribe on unserve", async () => {
      const state = createMockState();
      const server = new NatsRpcServer({
        state,
        logger: createMockLogger() as any,
        requestTarget: TckNatsRpcSrvReq as any,
        responseTarget: TckNatsRpcSrvRes as any,
      });

      await server.serve(async () => ({ result: "x" }) as any);

      await server.unserve();

      expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("should allow re-registration after unserve", async () => {
      const state = createMockState();
      const server = new NatsRpcServer({
        state,
        logger: createMockLogger() as any,
        requestTarget: TckNatsRpcSrvReq as any,
        responseTarget: TckNatsRpcSrvRes as any,
      });

      await server.serve(async () => ({ result: "x" }) as any);
      await server.unserve();
      await server.serve(async () => ({ result: "y" }) as any);

      expect(state.nc!.subscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe("unserveAll", () => {
    it("should unsubscribe all registered handlers", async () => {
      const state = createMockState();
      const server = new NatsRpcServer({
        state,
        logger: createMockLogger() as any,
        requestTarget: TckNatsRpcSrvReq as any,
        responseTarget: TckNatsRpcSrvRes as any,
      });

      await server.serve(async () => ({ result: "x" }) as any);

      await server.unserveAll();

      expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("should be safe to call with no registered handlers", async () => {
      const state = createMockState();
      const server = new NatsRpcServer({
        state,
        logger: createMockLogger() as any,
        requestTarget: TckNatsRpcSrvReq as any,
        responseTarget: TckNatsRpcSrvRes as any,
      });

      await expect(server.unserveAll()).resolves.toBeUndefined();
    });
  });
});
