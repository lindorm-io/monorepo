import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RabbitSharedState } from "../types/rabbit-types";
import { RabbitStreamProcessor } from "./RabbitStreamProcessor";
import { RabbitStreamPipeline } from "./RabbitStreamPipeline";

// --- Test messages ---

@Message({ name: "TckRabbitSpIn" })
class TckRabbitSpIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckRabbitSpOut" })
class TckRabbitSpOut implements IMessage {
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

const createMockState = (): RabbitSharedState => ({
  connection: null,
  publishChannel: null,
  consumeChannel: null,
  exchange: "test-exchange",
  dlxExchange: "test-exchange.dlx",
  dlqQueue: "test-exchange.dlq",
  consumerRegistrations: [],
  assertedQueues: new Set(),
  assertedDelayQueues: new Set(),
  replyConsumerTags: [],
  reconnecting: false,
  prefetch: 10,
  inFlightCount: 0,
});

// --- Tests ---

beforeEach(() => {
  clearRegistry();
});

describe("RabbitStreamProcessor", () => {
  it("should create a processor", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor({
      state,
      logger: createMockLogger() as any,
    });
    expect(processor).toBeDefined();
  });

  it("should return new processor from from()", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.from(TckRabbitSpIn as any);
    expect(next).toBeInstanceOf(RabbitStreamProcessor);
    expect(next).not.toBe(processor);
  });

  it("should return new processor from filter()", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor<TckRabbitSpIn, TckRabbitSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.filter((msg) => msg.value > 0);
    expect(next).toBeInstanceOf(RabbitStreamProcessor);
  });

  it("should return new processor from map()", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor<TckRabbitSpIn, TckRabbitSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.map((msg) => ({ result: msg.value * 2 }) as any);
    expect(next).toBeInstanceOf(RabbitStreamProcessor);
  });

  it("should return new processor from flatMap()", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor<TckRabbitSpIn, TckRabbitSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.flatMap((msg) => [{ result: msg.value } as any]);
    expect(next).toBeInstanceOf(RabbitStreamProcessor);
  });

  it("should return new processor from batch()", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor<TckRabbitSpIn, TckRabbitSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const next = processor.batch(5);
    expect(next).toBeInstanceOf(RabbitStreamProcessor);
  });

  it("should throw on second batch stage", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor<TckRabbitSpIn, TckRabbitSpOut>({
      state,
      logger: createMockLogger() as any,
    });
    const batched = processor.batch(5);
    expect(() => (batched as any).batch(10)).toThrow("Only one batch stage is allowed");
  });

  it("should return RabbitStreamPipeline from to()", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor({
      state,
      logger: createMockLogger() as any,
      inputClass: TckRabbitSpIn as any,
    });
    const pipeline = processor.to(TckRabbitSpOut as any);
    expect(pipeline).toBeInstanceOf(RabbitStreamPipeline);
  });

  it("should preserve stages through chained operations", () => {
    const state = createMockState();
    const processor = new RabbitStreamProcessor<TckRabbitSpIn, TckRabbitSpOut>({
      state,
      logger: createMockLogger() as any,
      inputClass: TckRabbitSpIn as any,
    });

    const pipeline = processor
      .filter((msg) => msg.value > 0)
      .map((msg) => ({ result: msg.value * 2 }) as any)
      .to(TckRabbitSpOut as any);

    expect(pipeline).toBeInstanceOf(RabbitStreamPipeline);
  });
});
