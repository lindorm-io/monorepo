import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { KafkaSharedState, KafkaConsumerHandle } from "../types/kafka-types";
import { KafkaRpcClient } from "./KafkaRpcClient";

// --- Mocks ---
let mockCreateKafkaConsumerResult: KafkaConsumerHandle;
const mockCreateKafkaConsumer = jest
  .fn()
  .mockImplementation(async () => mockCreateKafkaConsumerResult);
jest.mock("../utils/create-kafka-consumer", () => ({
  createKafkaConsumer: (...args: Array<unknown>) => mockCreateKafkaConsumer(...args),
}));

const mockStopKafkaConsumer = jest.fn().mockResolvedValue(undefined);
jest.mock("../utils/stop-kafka-consumer", () => ({
  stopKafkaConsumer: (...args: Array<unknown>) => mockStopKafkaConsumer(...args),
}));

const mockEnsureKafkaTopicFromState = jest.fn().mockResolvedValue(undefined);
jest.mock("../utils/ensure-kafka-topic", () => ({
  ensureKafkaTopicFromState: (...args: Array<unknown>) =>
    mockEnsureKafkaTopicFromState(...args),
}));

jest.mock("../utils/serialize-kafka-message", () => ({
  serializeKafkaMessage: jest
    .fn()
    .mockReturnValue({ key: null, value: Buffer.from("test"), headers: {} }),
}));

jest.mock("../utils/parse-kafka-message", () => ({
  parseKafkaMessage: jest.fn(),
}));

// --- Test messages ---

@Message({ name: "TckKafkaRpcReq" })
class TckKafkaRpcReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckKafkaRpcRes" })
class TckKafkaRpcRes implements IMessage {
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

const createMockConsumer = () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  run: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  resume: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  commitOffsets: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnValue(() => {}),
  events: {
    GROUP_JOIN: "consumer.group_join",
    HEARTBEAT: "consumer.heartbeat",
    COMMIT_OFFSETS: "consumer.commit_offsets",
    STOP: "consumer.stop",
    DISCONNECT: "consumer.disconnect",
    CONNECT: "consumer.connect",
    FETCH_START: "consumer.fetch_start",
    FETCH: "consumer.fetch",
    START_BATCH_PROCESS: "consumer.start_batch_process",
    END_BATCH_PROCESS: "consumer.end_batch_process",
    CRASH: "consumer.crash",
    RECEIVED_UNSUBSCRIBED_TOPICS: "consumer.received_unsubscribed_topics",
    REQUEST_TIMEOUT: "consumer.request_timeout",
  },
});

const createMockState = (): KafkaSharedState => ({
  kafka: {
    producer: jest.fn(),
    consumer: jest.fn().mockReturnValue(createMockConsumer()),
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
  mockCreateKafkaConsumer.mockClear();
  mockStopKafkaConsumer.mockClear();
  mockEnsureKafkaTopicFromState.mockClear();
  mockCreateKafkaConsumerResult = {
    consumerTag: "reply-ctag",
    groupId: "reply-group",
    topic: "iris.rpc.reply.test",
    consumer: createMockConsumer() as any,
  };
});

describe("KafkaRpcClient", () => {
  it("should create a client instance", () => {
    const state = createMockState();
    const client = new KafkaRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcReq as any,
      responseTarget: TckKafkaRpcRes as any,
    });
    expect(client).toBeDefined();
  });

  it("should throw when producer is not available", async () => {
    const state = createMockState();
    state.producer = null;

    const client = new KafkaRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcReq as any,
      responseTarget: TckKafkaRpcRes as any,
    });

    const msg = { query: "test" } as any;
    await expect(client.request(msg, { timeout: 100 })).rejects.toThrow(
      "Cannot send RPC request: producer is not connected",
    );
  });

  it("should reject pending requests on close", async () => {
    const state = createMockState();
    const client = new KafkaRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcReq as any,
      responseTarget: TckKafkaRpcRes as any,
    });

    const requestPromise = client.request({ query: "test" } as any, { timeout: 60000 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    await client.close();

    await expect(requestPromise).rejects.toThrow(
      "RPC client closed while request was pending",
    );
  }, 10000);

  it("should start reply consumer on first request", async () => {
    const state = createMockState();
    const client = new KafkaRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcReq as any,
      responseTarget: TckKafkaRpcRes as any,
    });

    const requestPromise = client.request({ query: "test" } as any, { timeout: 100 });

    // Allow async ensureKafkaTopicFromState + createKafkaConsumer to resolve
    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(mockEnsureKafkaTopicFromState).toHaveBeenCalledTimes(1);
    expect(mockCreateKafkaConsumer).toHaveBeenCalledTimes(1);

    await client.close();
    await requestPromise.catch(() => {});
  });

  it("should register pending request before publishing to Kafka", async () => {
    const state = createMockState();
    const callOrder: Array<string> = [];

    // Track order: producer.send is the publish call
    (state.producer!.send as jest.Mock).mockImplementation(async () => {
      callOrder.push("send");
      return undefined;
    });

    const client = new KafkaRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcReq as any,
      responseTarget: TckKafkaRpcRes as any,
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

    // register must happen before send
    expect(callOrder.indexOf("register")).toBeLessThan(callOrder.indexOf("send"));

    await client.close();
    await requestPromise.catch(() => {});
  }, 10000);

  it("should not start multiple reply consumers on concurrent requests", async () => {
    const state = createMockState();
    const client = new KafkaRpcClient({
      state,
      logger: createMockLogger() as any,
      requestTarget: TckKafkaRpcReq as any,
      responseTarget: TckKafkaRpcRes as any,
    });

    const p1 = client.request({ query: "a" } as any, { timeout: 100 });
    const p2 = client.request({ query: "b" } as any, { timeout: 100 });

    // Allow async ensureKafkaTopicFromState + createKafkaConsumer to resolve
    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(mockCreateKafkaConsumer).toHaveBeenCalledTimes(1);

    await client.close();
    await p1.catch(() => {});
    await p2.catch(() => {});
  });
});
