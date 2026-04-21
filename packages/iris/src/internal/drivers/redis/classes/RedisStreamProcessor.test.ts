import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { RedisSharedState } from "../types/redis-types.js";
import { RedisStreamProcessor } from "./RedisStreamProcessor.js";
import { RedisStreamPipeline } from "./RedisStreamPipeline.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test messages ---

@Message({ name: "TckRedisSpIn" })
class TckRedisSpIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckRedisSpOut" })
class TckRedisSpOut implements IMessage {
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

const createMockState = (): RedisSharedState => ({
  publishConnection: null,
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
});

describe("RedisStreamProcessor", () => {
  it("should create a processor", () => {
    const state = createMockState();
    const processor = new RedisStreamProcessor({
      state,
      logger: createMockLogger() as any,
    });
    expect(processor).toBeDefined();
  });

  it("should return new processor from from()", () => {
    const state = createMockState();
    const processor = new RedisStreamProcessor({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.from(TckRedisSpIn as any);
    expect(next).toBeInstanceOf(RedisStreamProcessor);
    expect(next).not.toBe(processor);
  });

  it("should return new processor from filter()", () => {
    const state = createMockState();
    const processor = new RedisStreamProcessor<TckRedisSpIn, TckRedisSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.filter((msg) => msg.value > 0);
    expect(next).toBeInstanceOf(RedisStreamProcessor);
  });

  it("should return new processor from map()", () => {
    const state = createMockState();
    const processor = new RedisStreamProcessor<TckRedisSpIn, TckRedisSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.map((msg) => ({ result: msg.value * 2 }) as any);
    expect(next).toBeInstanceOf(RedisStreamProcessor);
  });

  it("should return new processor from flatMap()", () => {
    const state = createMockState();
    const processor = new RedisStreamProcessor<TckRedisSpIn, TckRedisSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.flatMap((msg) => [{ result: msg.value } as any]);
    expect(next).toBeInstanceOf(RedisStreamProcessor);
  });

  it("should return new processor from batch()", () => {
    const state = createMockState();
    const processor = new RedisStreamProcessor<TckRedisSpIn, TckRedisSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.batch(5);
    expect(next).toBeInstanceOf(RedisStreamProcessor);
  });

  it("should throw on second batch stage", () => {
    const state = createMockState();
    const processor = new RedisStreamProcessor<TckRedisSpIn, TckRedisSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const batched = processor.batch(5);
    expect(() => (batched as any).batch(10)).toThrow("Only one batch stage is allowed");
  });

  it("should return RedisStreamPipeline from to()", () => {
    const state = createMockState();
    const processor = new RedisStreamProcessor({
      state,
      logger: createMockLogger() as any,
      inputClass: TckRedisSpIn as any,
    });
    const pipeline = processor.to(TckRedisSpOut as any);
    expect(pipeline).toBeInstanceOf(RedisStreamPipeline);
  });
});
