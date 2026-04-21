import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { KafkaSharedState, KafkaConsumerHandle } from "../types/kafka-types";
import { KafkaStreamPipeline } from "./KafkaStreamPipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---
let mockCreateKafkaConsumerResult: KafkaConsumerHandle;
const mockCreateKafkaConsumer = vi
  .fn()
  .mockImplementation(async () => mockCreateKafkaConsumerResult);
vi.mock("../utils/create-kafka-consumer", async () => ({
  createKafkaConsumer: (...args: Array<unknown>) => mockCreateKafkaConsumer(...args),
}));

const mockStopKafkaConsumer = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/stop-kafka-consumer", () => ({
  stopKafkaConsumer: (...args: Array<unknown>) => mockStopKafkaConsumer(...args),
}));

vi.mock("../utils/serialize-kafka-message", () => ({
  serializeKafkaMessage: vi
    .fn()
    .mockReturnValue({ key: null, value: Buffer.from("test"), headers: {} }),
}));

// --- Test messages ---

@Message({ name: "TckKafkaPlIn" })
class TckKafkaPlIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckKafkaPlOut" })
class TckKafkaPlOut implements IMessage {
  @Field("integer") result!: number;
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

const createMockConsumer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  run: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
  commitOffsets: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockReturnValue(() => {}),
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
    producer: vi.fn(),
    consumer: vi.fn().mockReturnValue(createMockConsumer()),
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
  inFlightCount: 0,
  prefetch: 10,
  sessionTimeoutMs: 30000,
  acks: -1,
  consumerPool: new Map(),
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

  const consumer = createMockConsumer();
  mockCreateKafkaConsumerResult = {
    consumerTag: "pl-ctag",
    groupId: "iris.pipeline.test",
    topic: "iris.TckKafkaPlIn",
    consumer: consumer as any,
  };
});

describe("KafkaStreamPipeline", () => {
  it("should throw when no inputClass provided", async () => {
    const state = createMockState();
    const pipeline = new KafkaStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      outputClass: TckKafkaPlOut as any,
    });

    await expect(pipeline.start()).rejects.toThrow(
      "Stream pipeline requires an input class",
    );
  });

  it("should start successfully", async () => {
    const state = createMockState();
    const pipeline = new KafkaStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckKafkaPlIn as any,
      outputClass: TckKafkaPlOut as any,
    });

    await pipeline.start();

    expect(mockCreateKafkaConsumer).toHaveBeenCalledTimes(1);
    expect(pipeline.isRunning()).toBe(true);
  });

  it("should stop and clean up consumer", async () => {
    const state = createMockState();
    const pipeline = new KafkaStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckKafkaPlIn as any,
      outputClass: TckKafkaPlOut as any,
    });

    await pipeline.start();

    await pipeline.stop();

    expect(mockStopKafkaConsumer).toHaveBeenCalledTimes(1);
    expect(pipeline.isRunning()).toBe(false);
  });

  it("should pause and resume", async () => {
    const consumer = createMockConsumer();
    mockCreateKafkaConsumerResult = {
      consumerTag: "pl-ctag-pause",
      groupId: "iris.pipeline.test",
      topic: "iris.TckKafkaPlIn",
      consumer: consumer as any,
    };

    const state = createMockState();
    const pipeline = new KafkaStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckKafkaPlIn as any,
      outputClass: TckKafkaPlOut as any,
    });

    await pipeline.start();

    await pipeline.pause();
    expect(pipeline.isRunning()).toBe(false);
    // Pause stops the consumer entirely (not Kafka pause) so messages
    // published during the pause window are skipped on resume.
    expect(mockStopKafkaConsumer).toHaveBeenCalled();

    await pipeline.resume();
    expect(pipeline.isRunning()).toBe(true);
    // Resume creates a brand-new consumer (second call to createKafkaConsumer)
    expect(mockCreateKafkaConsumer).toHaveBeenCalledTimes(2);
  });

  it("should not double-start", async () => {
    const state = createMockState();
    const pipeline = new KafkaStreamPipeline({
      state,
      logger: createMockLogger() as any,
      stages: [],
      inputClass: TckKafkaPlIn as any,
      outputClass: TckKafkaPlOut as any,
    });

    await pipeline.start();

    await pipeline.start(); // Should be no-op

    // Only created once because the consumer still exists in state.consumers
    expect(mockCreateKafkaConsumer).toHaveBeenCalledTimes(1);
  });
});
