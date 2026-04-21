import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisStreamPipeline, IMessage } from "../../interfaces";
import type { PipelineStage } from "../types/pipeline-stage";
import { Field } from "../../decorators/Field";
import { Message } from "../../decorators/Message";
import { clearRegistry } from "../message/metadata/registry";
import { IrisNotSupportedError } from "../../errors/IrisNotSupportedError";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseOptions,
} from "./DriverStreamProcessorBase";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Test messages ---

@Message({ name: "TckBaseIn" })
class TckBaseIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckBaseOut" })
class TckBaseOut implements IMessage {
  @Field("integer") result!: number;
}

// --- Mock pipeline ---

class MockPipeline implements IIrisStreamPipeline {
  public readonly options: any;
  constructor(options: any) {
    this.options = options;
  }
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  isRunning(): boolean {
    return false;
  }
}

// --- Concrete subclass ---

type MockState = { name: string };

class TestStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<MockState, MockPipeline, In, Out> {
  protected createSelf(
    options: DriverStreamProcessorBaseOptions<MockState>,
  ): TestStreamProcessor<any, any> {
    return new TestStreamProcessor(options);
  }

  protected createPipeline(options: {
    state: MockState;
    logger: ILogger;
    stages: Array<PipelineStage>;
    inputClass?: Constructor<IMessage>;
    inputTopic?: string;
    outputClass: Constructor<IMessage>;
    outputTopic?: string;
    context?: unknown;
    amphora?: unknown;
  }): MockPipeline {
    return new MockPipeline(options);
  }
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
  const state: MockState = { name: "test" };
  const logger = createMockLogger() as any;
  return new TestStreamProcessor({ state, logger });
};

// --- Tests ---

describe("DriverStreamProcessorBase", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("immutable builder", () => {
    it("should return new instance from from()", () => {
      const processor = createProcessor();
      const result = processor.from(TckBaseIn);
      expect(result).toBeInstanceOf(TestStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should return new instance from filter()", () => {
      const processor = createProcessor();
      const result = processor.filter(() => true);
      expect(result).toBeInstanceOf(TestStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should return new instance from map()", () => {
      const processor = createProcessor();
      const result = processor.map((msg: any) => msg);
      expect(result).toBeInstanceOf(TestStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should return new instance from flatMap()", () => {
      const processor = createProcessor();
      const result = processor.flatMap((msg: any) => [msg]);
      expect(result).toBeInstanceOf(TestStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should return new instance from batch()", () => {
      const processor = createProcessor();
      const result = processor.batch(10);
      expect(result).toBeInstanceOf(TestStreamProcessor);
      expect(result).not.toBe(processor);
    });

    it("should not modify original stages", () => {
      const processor = createProcessor();
      const originalStages = (processor as any).stages;

      processor.filter(() => true);
      processor.map((msg: any) => msg);
      processor.flatMap((msg: any) => [msg]);
      processor.batch(5);

      expect(originalStages).toHaveLength(0);
    });
  });

  describe("from()", () => {
    it("should set inputClass on returned processor", () => {
      const processor = createProcessor();
      const result = processor.from(TckBaseIn) as any;
      expect(result.inputClass).toBe(TckBaseIn);
    });

    it("should accept optional topic override", () => {
      const processor = createProcessor();
      const result = processor.from(TckBaseIn, { topic: "custom-topic" }) as any;
      expect(result.inputTopic).toBe("custom-topic");
    });
  });

  describe("batch()", () => {
    it("should throw on second batch stage", () => {
      const processor = createProcessor();
      const batched = processor.batch(5);
      expect(() => (batched as any).batch(10)).toThrow(IrisNotSupportedError);
      expect(() => (batched as any).batch(10)).toThrow("Only one batch stage is allowed");
    });
  });

  describe("to()", () => {
    it("should return pipeline from createPipeline", () => {
      const processor = createProcessor();
      const pipeline = processor.from(TckBaseIn).to(TckBaseOut as any);
      expect(pipeline).toBeInstanceOf(MockPipeline);
    });

    it("should pass all options to createPipeline", () => {
      const processor = createProcessor();
      const pipeline = processor
        .from(TckBaseIn, { topic: "in-topic" })
        .filter(() => true)
        .to(TckBaseOut as any, { topic: "out-topic" }) as MockPipeline;

      expect(pipeline.options.inputClass).toBe(TckBaseIn);
      expect(pipeline.options.inputTopic).toBe("in-topic");
      expect(pipeline.options.outputClass).toBe(TckBaseOut);
      expect(pipeline.options.outputTopic).toBe("out-topic");
      expect(pipeline.options.stages).toHaveLength(1);
      expect(pipeline.options.stages[0].type).toBe("filter");
    });
  });
});
