import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { KafkaSharedState } from "../types/kafka-types";
import { KafkaRpcServer } from "./KafkaRpcServer";

// --- Mocks ---
let mockGetOrCreateResult: { consumerTag: string };
const mockGetOrCreatePooledConsumer = jest
  .fn()
  .mockImplementation(async () => mockGetOrCreateResult);
jest.mock("../utils/create-kafka-consumer", () => ({
  getOrCreatePooledConsumer: (...args: Array<unknown>) =>
    mockGetOrCreatePooledConsumer(...args),
}));

const mockReleasePooledConsumer = jest.fn().mockResolvedValue(undefined);
jest.mock("../utils/stop-kafka-consumer", () => ({
  releasePooledConsumer: (...args: Array<unknown>) => mockReleasePooledConsumer(...args),
}));

jest.mock("../utils/serialize-kafka-message", () => ({
  serializeKafkaMessage: jest
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
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createMockState = (): KafkaSharedState => ({
  kafka: {
    producer: jest.fn(),
    consumer: jest.fn(),
    admin: jest.fn(),
  } as any,
  admin: null,
  producer: {
    send: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(),
    disconnect: jest.fn(),
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
