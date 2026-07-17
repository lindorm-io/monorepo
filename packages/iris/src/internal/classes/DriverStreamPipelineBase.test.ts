import type { IMessage } from "../../interfaces/index.js";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import { Field } from "../../decorators/Field.js";
import { Message } from "../../decorators/Message.js";
import { clearRegistry } from "../message/metadata/registry.js";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "./DriverStreamPipelineBase.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Test messages ---

@Message({ name: "TckPipeBaseIn" })
class TckPipeBaseIn implements IMessage {
  @Field("integer") value!: number;
  @Field("string") label!: string;
}

@Message({ name: "TckPipeBaseOut" })
class TckPipeBaseOut implements IMessage {
  @Field("integer") doubled!: number;
  @Field("string") label!: string;
}

// --- Mock logger ---

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

// --- Concrete test subclass ---

class TestStreamPipeline extends DriverStreamPipelineBase {
  public readonly publishedEnvelopes: Array<{ envelope: IrisEnvelope; topic: string }> =
    [];

  public constructor(options: DriverStreamPipelineBaseOptions) {
    super(options);
  }

  public async start(): Promise<void> {
    this.running = true;
    this.paused = false;
  }

  protected async doStopConsumer(): Promise<void> {
    // No real consumer to tear down in the test double.
  }

  public async pause(): Promise<void> {
    this.paused = true;
  }

  public async resume(): Promise<void> {
    this.paused = false;
  }

  protected async doPublishEnvelope(
    envelope: IrisEnvelope,
    topic: string,
  ): Promise<void> {
    this.publishedEnvelopes.push({ envelope, topic });
  }

  // Expose protected methods for testing. processStreamMessage is the consume
  // `callback` handed to consumeMessageCore via each driver's wrap*Consumer — it
  // receives an ALREADY-deserialized message (deserialization happens in the
  // host's prepareForConsume) and runs the transform stages + publish.
  public async testProcessStreamMessage(message: any): Promise<void> {
    return this.processStreamMessage(message);
  }

  public async testPublishOutput(data: any): Promise<void> {
    return this.publishOutput(data);
  }
}

// --- Tests ---

describe("DriverStreamPipelineBase", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("isRunning()", () => {
    it("should return false when not started", () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      expect(pipeline.isRunning()).toBe(false);
    });

    it("should return true when running and not paused", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();
      expect(pipeline.isRunning()).toBe(true);
    });

    it("should return false when paused", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();
      await pipeline.pause();
      expect(pipeline.isRunning()).toBe(false);
    });
  });

  describe("publishOutput()", () => {
    it("should hydrate, validate, and publish via doPublishEnvelope", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();

      await pipeline.testPublishOutput({ doubled: 42, label: "test" });

      expect(pipeline.publishedEnvelopes).toHaveLength(1);
      expect(pipeline.publishedEnvelopes[0].topic).toBe("TckPipeBaseOut");
      expect(pipeline.publishedEnvelopes[0].envelope).toMatchSnapshot({
        payload: expect.any(Buffer),
        timestamp: expect.any(Number),
      });
    });

    it("should use outputTopic override when provided", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
        outputTopic: "custom-output",
      });

      await pipeline.start();

      await pipeline.testPublishOutput({ doubled: 1, label: "x" });

      expect(pipeline.publishedEnvelopes[0].topic).toBe("custom-output");
    });
  });

  describe("processStreamMessage()", () => {
    const mapStage = {
      type: "map" as const,
      transform: (msg: any) => ({ doubled: msg.value * 2, label: msg.label }),
    };

    it("should not process when paused", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [mapStage],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();
      await pipeline.pause();

      await pipeline.testProcessStreamMessage({ value: 5, label: "test" });

      expect(pipeline.publishedEnvelopes).toHaveLength(0);
    });

    it("should not process when not running", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [mapStage],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      // Never started
      await pipeline.testProcessStreamMessage({ value: 5, label: "test" });

      expect(pipeline.publishedEnvelopes).toHaveLength(0);
    });

    it("should run stages and publish the output", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [mapStage],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();

      await pipeline.testProcessStreamMessage({ value: 5, label: "test" });

      expect(pipeline.publishedEnvelopes).toHaveLength(1);
      expect(pipeline.publishedEnvelopes[0].topic).toBe("TckPipeBaseOut");
    });

    it("should PROPAGATE stage errors (not swallow them) so the driver can redeliver/dead-letter (H5)", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [
          {
            type: "map",
            transform: () => {
              throw new Error("stage-boom");
            },
          },
        ],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();

      // Before the H5 fix the base swallowed this error and resolved normally,
      // giving at-most-once delivery. It must now reject so consumeMessageCore
      // (via the driver's wrap*Consumer) triggers retry + dead-letter.
      await expect(
        pipeline.testProcessStreamMessage({ value: 5, label: "test" }),
      ).rejects.toThrow("stage-boom");

      expect(pipeline.publishedEnvelopes).toHaveLength(0);
    });

    it("should keep the processing queue alive after an error (next message still flows)", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [
          {
            type: "map",
            transform: (msg: any) => {
              if (msg.value < 0) throw new Error("negative");
              return { doubled: msg.value * 2, label: msg.label };
            },
          },
        ],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();

      await expect(
        pipeline.testProcessStreamMessage({ value: -1, label: "bad" }),
      ).rejects.toThrow("negative");

      // A poisoned message must not wedge the serialization chain for good ones.
      await pipeline.testProcessStreamMessage({ value: 3, label: "good" });

      expect(pipeline.publishedEnvelopes).toHaveLength(1);
      expect(pipeline.publishedEnvelopes[0].topic).toBe("TckPipeBaseOut");
    });
  });

  describe("resetBatchTimer()", () => {
    it("should route timer flush through _processingQueue to prevent races", async () => {
      vi.useFakeTimers();

      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();

      // Access protected members to verify serialization
      const pipelineAny = pipeline as any;

      // Manually push items into the batch buffer
      pipelineAny.batchBuffer.push({ doubled: 1, label: "a" });
      pipelineAny.batchBuffer.push({ doubled: 2, label: "b" });

      // Call resetBatchTimer with a short timeout
      pipelineAny.resetBatchTimer({ size: 10, timeout: 50 });

      // Advance the timer to trigger the flush
      vi.advanceTimersByTime(50);

      // The flush should be queued on _processingQueue, not called directly
      // Verify that _processingQueue is no longer the initial resolved promise
      const queue: Promise<void> = pipelineAny._processingQueue;
      expect(queue).toBeInstanceOf(Promise);

      // Wait for the queue to settle
      vi.useRealTimers();
      await queue;

      // Buffer should have been flushed
      expect(pipelineAny.batchBuffer).toHaveLength(0);
    });
  });

  describe("flushBatchBuffer()", () => {
    it("should route through _processingQueue to serialise with processInboundData", async () => {
      const executionOrder: Array<string> = [];

      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();

      const pipelineAny = pipeline as any;

      // Inject a slow task into the processing queue to simulate an in-progress processInboundData
      pipelineAny._processingQueue = pipelineAny._processingQueue.then(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              executionOrder.push("slow-task-done");
              resolve();
            }, 50);
          }),
      );

      // Seed the batch buffer with items
      pipelineAny.batchBuffer.push({ doubled: 1, label: "a" });

      // Also seed a batch stage so doFlushBatchBuffer finds the index
      pipelineAny.stages.push({ type: "batch", size: 100, timeout: 5000 });

      // flushBatchBuffer should wait for the slow task to finish first
      const flushPromise = pipeline.stop();

      executionOrder.push("flush-called");

      await flushPromise;

      executionOrder.push("flush-resolved");

      // The slow task must have completed before flush resolved
      expect(executionOrder).toEqual([
        "flush-called",
        "slow-task-done",
        "flush-resolved",
      ]);

      // Buffer should have been flushed
      expect(pipelineAny.batchBuffer).toHaveLength(0);
    });
  });

  describe("stop()", () => {
    it("should be idempotent", async () => {
      const pipeline = new TestStreamPipeline({
        logger: createMockLogger() as any,
        stages: [],
        inputClass: TckPipeBaseIn as any,
        outputClass: TckPipeBaseOut as any,
      });

      await pipeline.start();
      await pipeline.stop();
      await pipeline.stop(); // should be no-op

      expect(pipeline.isRunning()).toBe(false);
    });
  });
});
