import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import { MemoryStreamProcessor } from "./MemoryStreamProcessor.js";
import { MemoryStreamPipeline } from "./MemoryStreamPipeline.js";
import { createStore } from "../utils/create-store.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

@Message({ name: "TckStreamIn" })
class TckStreamIn implements IMessage {
  @Field("integer") value!: number;
  @Field("string") label!: string;
}

@Message({ name: "TckStreamOut" })
class TckStreamOut implements IMessage {
  @Field("integer") doubled!: number;
  @Field("string") label!: string;
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

const createProcessor = () => {
  const store = createStore();
  const logger = createMockLogger() as any;
  const processor = new MemoryStreamProcessor({
    state: store,
    logger,
  });
  return { processor, store, logger };
};

// --- Tests ---

describe("MemoryStreamProcessor", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("immutable builder", () => {
    it("should return new instance from from()", () => {
      const { processor } = createProcessor();
      const result = processor.from(TckStreamIn);
      expect(result).toBeInstanceOf(MemoryStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should return new instance from filter()", () => {
      const { processor } = createProcessor();
      const result = processor.filter(() => true);
      expect(result).toBeInstanceOf(MemoryStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should return new instance from map()", () => {
      const { processor } = createProcessor();
      const result = processor.map((msg: any) => msg);
      expect(result).toBeInstanceOf(MemoryStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should return new instance from flatMap()", () => {
      const { processor } = createProcessor();
      const result = processor.flatMap((msg: any) => [msg]);
      expect(result).toBeInstanceOf(MemoryStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should return new instance from batch()", () => {
      const { processor } = createProcessor();
      const result = processor.batch(10);
      expect(result).toBeInstanceOf(MemoryStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should not modify original stages", () => {
      const { processor } = createProcessor();
      const original = processor as any;
      const originalStages = original.stages;

      processor.filter(() => true);
      processor.map((msg: any) => msg);
      processor.flatMap((msg: any) => [msg]);
      processor.batch(5);

      expect(originalStages).toHaveLength(0);
    });
  });

  describe("from()", () => {
    it("should set inputClass on returned processor", () => {
      const { processor } = createProcessor();
      const result = processor.from(TckStreamIn) as any;
      expect(result.inputClass).toBe(TckStreamIn);
    });

    it("should accept optional topic override", () => {
      const { processor } = createProcessor();
      const result = processor.from(TckStreamIn, { topic: "custom-topic" }) as any;
      expect(result.inputTopic).toBe("custom-topic");
    });
  });

  describe("to()", () => {
    it("should return a MemoryStreamPipeline", () => {
      const { processor } = createProcessor();
      const pipeline = processor.from(TckStreamIn).to(TckStreamOut as any);
      expect(pipeline).toBeInstanceOf(MemoryStreamPipeline);
    });
  });

  describe("chaining", () => {
    it("should support from().filter().map().to() chain", () => {
      const { processor } = createProcessor();
      const pipeline = processor
        .from(TckStreamIn)
        .filter((msg: any) => msg.value > 0)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckStreamOut as any);

      expect(pipeline).toBeInstanceOf(MemoryStreamPipeline);
    });
  });
});
