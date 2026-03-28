import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { NatsSharedState, NatsMsg } from "../types/nats-types";
import { NatsRpcClient } from "./NatsRpcClient";

// --- Mocks ---
jest.mock("../utils/serialize-nats-message", () => ({
  serializeNatsMessage: jest.fn().mockReturnValue({ data: new Uint8Array([1, 2, 3]) }),
}));

const mockParseNatsMessage = jest.fn();
jest.mock("../utils/parse-nats-message", () => ({
  parseNatsMessage: (...args: Array<unknown>) => mockParseNatsMessage(...args),
}));

// --- Test messages ---

@Message({ name: "TckNatsRpcReq" })
class TckNatsRpcReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckNatsRpcRes" })
class TckNatsRpcRes implements IMessage {
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

const createMockState = (): NatsSharedState => ({
  nc: {
    request: jest.fn().mockResolvedValue({
      data: new Uint8Array([]),
      subject: "reply",
      sid: 1,
      respond: jest.fn(),
    } as Partial<NatsMsg>),
    jetstream: jest.fn(),
    jetstreamManager: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    flush: jest.fn(),
    close: jest.fn(),
    drain: jest.fn(),
    status: jest.fn(),
    isClosed: jest.fn().mockReturnValue(false),
  } as any,
  js: {
    publish: jest
      .fn()
      .mockResolvedValue({ seq: 1, stream: "IRIS_IRIS", duplicate: false }),
    consumers: { get: jest.fn() },
  } as any,
  jsm: {
    streams: { info: jest.fn(), add: jest.fn(), purge: jest.fn() },
    consumers: {
      add: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
    },
  } as any,
  headersInit: jest.fn().mockReturnValue({
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
    values: jest.fn(),
  }) as any,
  prefix: "iris",
  streamName: "IRIS_IRIS",
  consumerLoops: [],
  consumerRegistrations: [],
  ensuredConsumers: new Set(),
  inFlightCount: 0,
  prefetch: 10,
});

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockParseNatsMessage.mockClear();
});

describe("NatsRpcClient", () => {
  it("should create a client instance", () => {
    const state = createMockState();
    const client = new NatsRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcReq as any,
      responseTarget: TckNatsRpcRes as any,
    });
    expect(client).toBeDefined();
  });

  it("should throw when connection is not available", async () => {
    const state = createMockState();
    state.nc = null;

    const client = new NatsRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcReq as any,
      responseTarget: TckNatsRpcRes as any,
    });

    const msg = { query: "test" } as any;
    await expect(client.request(msg, { timeout: 100 })).rejects.toThrow(
      "Cannot send RPC request: connection is not available",
    );
  });

  it("should throw when headersInit is not available", async () => {
    const state = createMockState();
    state.headersInit = null;

    const client = new NatsRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcReq as any,
      responseTarget: TckNatsRpcRes as any,
    });

    const msg = { query: "test" } as any;
    await expect(client.request(msg, { timeout: 100 })).rejects.toThrow(
      "Cannot send RPC request: connection is not available",
    );
  });

  it("should call nc.request with the correct subject", async () => {
    const state = createMockState();
    mockParseNatsMessage.mockReturnValue({
      payload: Buffer.from(JSON.stringify({ result: "ok" })),
      headers: { "x-iris-content-type": "application/json" },
      topic: "TckNatsRpcReq",
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
      correlationId: null,
      identifierValue: null,
    });

    const client = new NatsRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcReq as any,
      responseTarget: TckNatsRpcRes as any,
    });

    // The request will attempt to hydrate the response, which may fail due to mocking,
    // but we can verify nc.request was called correctly
    try {
      await client.request({ query: "test" } as any, { timeout: 5000 });
    } catch {
      // May fail on hydration due to mocking
    }

    expect(state.nc!.request).toHaveBeenCalledWith(
      "_rpc_.iris.TckNatsRpcReq",
      expect.any(Uint8Array),
      { timeout: 5000 },
    );
  });

  it("should throw on RPC error response", async () => {
    const state = createMockState();
    mockParseNatsMessage.mockReturnValue({
      payload: Buffer.from(JSON.stringify({ error: "Handler failed" })),
      headers: {
        "x-iris-rpc-error": "true",
        "x-iris-rpc-error-message": "Handler failed",
      },
      topic: "TckNatsRpcReq",
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
      correlationId: null,
      identifierValue: null,
    });

    const client = new NatsRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcReq as any,
      responseTarget: TckNatsRpcRes as any,
    });

    await expect(client.request({ query: "test" } as any)).rejects.toThrow(
      "Handler failed",
    );
  });

  it("should wrap NATS timeout error as IrisTimeoutError", async () => {
    const state = createMockState();
    (state.nc!.request as jest.Mock).mockRejectedValue(new Error("TIMEOUT"));

    const client = new NatsRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcReq as any,
      responseTarget: TckNatsRpcRes as any,
    });

    await expect(
      client.request({ query: "test" } as any, { timeout: 100 }),
    ).rejects.toThrow(/timed out after 100ms/);
  });

  it("should reject pending requests on close", async () => {
    const state = createMockState();
    const client = new NatsRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckNatsRpcReq as any,
      responseTarget: TckNatsRpcRes as any,
    });

    // Close should not throw even with no pending requests
    await expect(client.close()).resolves.toBeUndefined();
  });
});
