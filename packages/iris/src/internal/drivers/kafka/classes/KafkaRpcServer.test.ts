import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { KafkaRpcServer } from "./KafkaRpcServer.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---
let mockGetOrCreateResult: { consumerTag: string };
const mockGetOrCreatePooledConsumer = vi
  .fn()
  .mockImplementation(async () => mockGetOrCreateResult);
vi.mock("../utils/create-kafka-consumer.js", async () => ({
  getOrCreatePooledConsumer: (...args: Array<unknown>) =>
    mockGetOrCreatePooledConsumer(...args),
}));

const mockReleasePooledConsumer = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/stop-kafka-consumer.js", () => ({
  releasePooledConsumer: (...args: Array<unknown>) => mockReleasePooledConsumer(...args),
}));

vi.mock("../utils/serialize-kafka-message.js", () => ({
  serializeKafkaMessage: vi
    .fn()
    .mockReturnValue({ key: null, value: Buffer.from("test"), headers: {} }),
}));

// --- Test messages ---

@Message({ name: "TckKafkaRpcSrvReq" })
class TckKafkaRpcSrvReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckKafkaRpcSrvRes" })
class TckKafkaRpcSrvRes implements IMessage {
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

const createMockState = (): KafkaSharedState => ({
  kafka: {
    producer: vi.fn(),
    consumer: vi.fn(),
    admin: vi.fn(),
  } as any,
  admin: null,
  producer: {
    send: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as any,
  connectionConfig: { brokers: ["localhost:9092"] },
  prefix: "iris",
  consumers: [],
  consumerRegistrations: [],
  consumerPool: new Map(),
  inFlightCount: 0,
  prefetch: 10,
  sessionTimeoutMs: 30000,
  acks: -1,
  createdTopics: new Set(),
  publishedTopics: new Set(),
  abortController: new AbortController(),
  resetGeneration: 0,
});

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockGetOrCreatePooledConsumer.mockClear();
  mockReleasePooledConsumer.mockClear();
  mockGetOrCreateResult = {
    consumerTag: "srv-ctag",
  };
});

describe("KafkaRpcServer", () => {
  it("should register handler via serve()", async () => {
    const state = createMockState();
    const server = new KafkaRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcSrvReq as any,
      responseTarget: TckKafkaRpcSrvRes as any,
    });

    await server.serve(async (req: any) => ({ result: req.query }) as any);

    expect(mockGetOrCreatePooledConsumer).toHaveBeenCalledTimes(1);
    const opts = mockGetOrCreatePooledConsumer.mock.calls[0][0];
    expect(opts.topic).toBe("iris.rpc.TckKafkaRpcSrvReq");
  });

  it("should throw when handler already registered for queue", async () => {
    const state = createMockState();
    const server = new KafkaRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcSrvReq as any,
      responseTarget: TckKafkaRpcSrvRes as any,
    });

    await server.serve(async (req) => ({ result: "a" }) as any);

    await expect(server.serve(async (req) => ({ result: "b" }) as any)).rejects.toThrow(
      "RPC handler already registered",
    );
  });

  it("should throw when kafka client is not available", async () => {
    const state = createMockState();
    state.kafka = null;
    state.producer = null;

    const server = new KafkaRpcServer({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcSrvReq as any,
      responseTarget: TckKafkaRpcSrvRes as any,
    });

    await expect(server.serve(async () => ({ result: "x" }) as any)).rejects.toThrow(
      "Cannot serve RPC: Kafka client is not connected",
    );
  });

  describe("unserve", () => {
    it("should release pooled consumer on unserve", async () => {
      const state = createMockState();
      const server = new KafkaRpcServer({
        state,
        logger: createMockLogger() as any,
        requestTarget: TckKafkaRpcSrvReq as any,
        responseTarget: TckKafkaRpcSrvRes as any,
      });

      await server.serve(async () => ({ result: "x" }) as any);

      await server.unserve();

      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(1);
      const opts = mockReleasePooledConsumer.mock.calls[0][0];
      expect(opts.topic).toBe("iris.rpc.TckKafkaRpcSrvReq");
    });
  });

  describe("unserveAll", () => {
    it("should release all registered handlers", async () => {
      const state = createMockState();
      const server = new KafkaRpcServer({
        state,
        logger: createMockLogger() as any,
        requestTarget: TckKafkaRpcSrvReq as any,
        responseTarget: TckKafkaRpcSrvRes as any,
      });

      await server.serve(async () => ({ result: "x" }) as any);

      await server.unserveAll();

      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(1);
    });
  });
});
