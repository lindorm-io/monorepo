import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { KafkaSharedState } from "../types/kafka-types";
import { KafkaStreamProcessor } from "./KafkaStreamProcessor";
import { KafkaStreamPipeline } from "./KafkaStreamPipeline";

// --- Test messages ---

@Message({ name: "TckKafkaSpIn" })
class TckKafkaSpIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckKafkaSpOut" })
class TckKafkaSpOut implements IMessage {
  @Field("integer") result!: number;
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
  kafka: null,
  admin: null,
  producer: null,
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
});

describe("KafkaStreamProcessor", () => {
  it("should create a processor", () => {
    const state = createMockState();
    const processor = new KafkaStreamProcessor({
      state,
      logger: createMockLogger() as any,
    });
    expect(processor).toBeDefined();
  });

  it("should return new processor from from()", () => {
    const state = createMockState();
    const processor = new KafkaStreamProcessor({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.from(TckKafkaSpIn as any);
    expect(next).toBeInstanceOf(KafkaStreamProcessor);
    expect(next).not.toBe(processor);
  });

  it("should return new processor from filter()", () => {
    const state = createMockState();
    const processor = new KafkaStreamProcessor<TckKafkaSpIn, TckKafkaSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.filter((msg) => msg.value > 0);
    expect(next).toBeInstanceOf(KafkaStreamProcessor);
  });

  it("should return new processor from map()", () => {
    const state = createMockState();
    const processor = new KafkaStreamProcessor<TckKafkaSpIn, TckKafkaSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.map((msg) => ({ result: msg.value * 2 }) as any);
    expect(next).toBeInstanceOf(KafkaStreamProcessor);
  });

  it("should return new processor from flatMap()", () => {
    const state = createMockState();
    const processor = new KafkaStreamProcessor<TckKafkaSpIn, TckKafkaSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.flatMap((msg) => [{ result: msg.value } as any]);
    expect(next).toBeInstanceOf(KafkaStreamProcessor);
  });

  it("should return new processor from batch()", () => {
    const state = createMockState();
    const processor = new KafkaStreamProcessor<TckKafkaSpIn, TckKafkaSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.batch(5);
    expect(next).toBeInstanceOf(KafkaStreamProcessor);
  });

  it("should throw on second batch stage", () => {
    const state = createMockState();
    const processor = new KafkaStreamProcessor<TckKafkaSpIn, TckKafkaSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const batched = processor.batch(5);
    expect(() => (batched as any).batch(10)).toThrow("Only one batch stage is allowed");
  });

  it("should return KafkaStreamPipeline from to()", () => {
    const state = createMockState();
    const processor = new KafkaStreamProcessor({
      state,
      logger: createMockLogger() as any,
      inputClass: TckKafkaSpIn as any,
    });
    const pipeline = processor.to(TckKafkaSpOut as any);
    expect(pipeline).toBeInstanceOf(KafkaStreamPipeline);
  });
});
