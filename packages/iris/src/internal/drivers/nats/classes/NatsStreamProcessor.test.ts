import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { NatsSharedState } from "../types/nats-types";
import { NatsStreamProcessor } from "./NatsStreamProcessor";
import { NatsStreamPipeline } from "./NatsStreamPipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test messages ---

@Message({ name: "TckNatsSpIn" })
class TckNatsSpIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckNatsSpOut" })
class TckNatsSpOut implements IMessage {
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

const createMockState = (): NatsSharedState => ({
  nc: null,
  js: null,
  jsm: null,
  headersInit: null,
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
});

describe("NatsStreamProcessor", () => {
  it("should create a processor", () => {
    const state = createMockState();
    const processor = new NatsStreamProcessor({
      state,
      logger: createMockLogger() as any,
    });
    expect(processor).toBeDefined();
  });

  it("should return new processor from from()", () => {
    const state = createMockState();
    const processor = new NatsStreamProcessor({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.from(TckNatsSpIn as any);
    expect(next).toBeInstanceOf(NatsStreamProcessor);
    expect(next).not.toBe(processor);
  });

  it("should return new processor from filter()", () => {
    const state = createMockState();
    const processor = new NatsStreamProcessor<TckNatsSpIn, TckNatsSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.filter((msg) => msg.value > 0);
    expect(next).toBeInstanceOf(NatsStreamProcessor);
  });

  it("should return new processor from map()", () => {
    const state = createMockState();
    const processor = new NatsStreamProcessor<TckNatsSpIn, TckNatsSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.map((msg) => ({ result: msg.value * 2 }) as any);
    expect(next).toBeInstanceOf(NatsStreamProcessor);
  });

  it("should return new processor from flatMap()", () => {
    const state = createMockState();
    const processor = new NatsStreamProcessor<TckNatsSpIn, TckNatsSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.flatMap((msg) => [{ result: msg.value } as any]);
    expect(next).toBeInstanceOf(NatsStreamProcessor);
  });

  it("should return new processor from batch()", () => {
    const state = createMockState();
    const processor = new NatsStreamProcessor<TckNatsSpIn, TckNatsSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.batch(5);
    expect(next).toBeInstanceOf(NatsStreamProcessor);
  });

  it("should throw on second batch stage", () => {
    const state = createMockState();
    const processor = new NatsStreamProcessor<TckNatsSpIn, TckNatsSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const batched = processor.batch(5);
    expect(() => (batched as any).batch(10)).toThrow("Only one batch stage is allowed");
  });

  it("should return NatsStreamPipeline from to()", () => {
    const state = createMockState();
    const processor = new NatsStreamProcessor({
      state,
      logger: createMockLogger() as any,
      inputClass: TckNatsSpIn as any,
    });
    const pipeline = processor.to(TckNatsSpOut as any);
    expect(pipeline).toBeInstanceOf(NatsStreamPipeline);
  });
});
