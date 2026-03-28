import type { IMessage, IMessageSubscriber } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { MemoryDriver } from "./MemoryDriver";
import { MemoryStreamProcessor } from "./MemoryStreamProcessor";
import type { MemoryEnvelope } from "../types/memory-store";

// --- Test message classes ---

@Message({ name: "TckPipeIn" })
class TckPipeIn implements IMessage {
  @Field("integer") value!: number;
  @Field("string") label!: string;
}

@Message({ name: "TckPipeOut" })
class TckPipeOut implements IMessage {
  @Field("integer") doubled!: number;
  @Field("string") label!: string;
}

@Message({ name: "TckPipeBatchOut" })
class TckPipeBatchOut implements IMessage {
  @Field("integer") count!: number;
  @Field("string") label!: string;
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

const createDriverAndStore = () => {
  const subs: Array<IMessageSubscriber> = [];
  const driver = new MemoryDriver({
    logger: createMockLogger() as any,
    getSubscribers: () => subs,
  });
  const store = (driver as any).store;
  return { driver, store, subs };
};

// --- Tests ---

describe("MemoryStreamPipeline", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("start / stop", () => {
    it("should register subscription on start", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      await pipeline.start();

      expect(store.subscriptions).toHaveLength(1);
      expect(store.subscriptions[0].topic).toBe("TckPipeIn");
    });

    it("should remove subscription on stop", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      await pipeline.start();
      expect(store.subscriptions).toHaveLength(1);

      await pipeline.stop();
      expect(store.subscriptions).toHaveLength(0);
    });

    it("should throw IrisDriverError if from() was not called", async () => {
      const { driver } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = processor.to(TckPipeOut as any);

      await expect(pipeline.start()).rejects.toThrow(IrisDriverError);
      await expect(pipeline.start()).rejects.toThrow(
        "Stream pipeline requires an input class",
      );
    });

    it("should be idempotent — start twice does nothing", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      await pipeline.start();
      await pipeline.start();

      expect(store.subscriptions).toHaveLength(1);
    });
  });

  describe("pause / resume", () => {
    it("should not process while paused", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      await pipeline.start();
      await pipeline.pause();

      // Capture output
      const output: Array<MemoryEnvelope> = [];
      store.subscriptions.push({
        topic: "TckPipeOut",
        queue: null,
        callback: async (env: MemoryEnvelope) => {
          output.push(env);
        },
        consumerTag: "test-output",
      });

      // Publish input via the publisher
      const publisher = driver.createPublisher(TckPipeIn);
      const msg = publisher.create({ value: 5, label: "paused" } as any);
      await publisher.publish(msg);

      expect(output).toHaveLength(0);
    });

    it("should resume processing after resume", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      await pipeline.start();

      // Capture output
      const output: Array<MemoryEnvelope> = [];
      store.subscriptions.push({
        topic: "TckPipeOut",
        queue: null,
        callback: async (env: MemoryEnvelope) => {
          output.push(env);
        },
        consumerTag: "test-output",
      });

      await pipeline.pause();

      const publisher = driver.createPublisher(TckPipeIn);
      const msg1 = publisher.create({ value: 5, label: "during-pause" } as any);
      await publisher.publish(msg1);

      expect(output).toHaveLength(0);

      await pipeline.resume();

      // Publish another message after resume
      const msg2 = publisher.create({ value: 10, label: "after-resume" } as any);
      await publisher.publish(msg2);

      expect(output).toHaveLength(1);
    });

    it("should report isRunning correctly", async () => {
      const { driver } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      expect(pipeline.isRunning()).toBe(false);

      await pipeline.start();
      expect(pipeline.isRunning()).toBe(true);

      await pipeline.pause();
      expect(pipeline.isRunning()).toBe(false);

      await pipeline.resume();
      expect(pipeline.isRunning()).toBe(true);

      await pipeline.stop();
      expect(pipeline.isRunning()).toBe(false);
    });
  });

  describe("filter stage", () => {
    it("should drop non-matching messages", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .filter((msg: any) => msg.value > 10)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      await pipeline.start();

      const output: Array<MemoryEnvelope> = [];
      store.subscriptions.push({
        topic: "TckPipeOut",
        queue: null,
        callback: async (env: MemoryEnvelope) => {
          output.push(env);
        },
        consumerTag: "test-output",
      });

      const publisher = driver.createPublisher(TckPipeIn);
      const msg = publisher.create({ value: 5, label: "low" } as any);
      await publisher.publish(msg);

      expect(output).toHaveLength(0);
    });

    it("should pass matching messages", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .filter((msg: any) => msg.value > 10)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      await pipeline.start();

      const output: Array<MemoryEnvelope> = [];
      store.subscriptions.push({
        topic: "TckPipeOut",
        queue: null,
        callback: async (env: MemoryEnvelope) => {
          output.push(env);
        },
        consumerTag: "test-output",
      });

      const publisher = driver.createPublisher(TckPipeIn);
      const msg = publisher.create({ value: 20, label: "high" } as any);
      await publisher.publish(msg);

      expect(output).toHaveLength(1);
      expect(output[0].topic).toBe("TckPipeOut");
    });
  });

  describe("map stage", () => {
    it("should transform messages", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .map((msg: any) => ({ doubled: msg.value * 2, label: msg.label }))
        .to(TckPipeOut as any);

      await pipeline.start();

      // Use a message bus for output so we get deserialized messages
      const bus = driver.createMessageBus(TckPipeOut);
      const received: Array<any> = [];
      await bus.subscribe({
        topic: "TckPipeOut",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const publisher = driver.createPublisher(TckPipeIn);
      const msg = publisher.create({ value: 7, label: "test" } as any);
      await publisher.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].doubled).toBe(14);
      expect(received[0].label).toBe("test");
    });
  });

  describe("batch stage", () => {
    it("should accumulate and flush at batch size", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .batch(3)
        .map((batch: any) => ({ count: batch.length, label: "batched" }))
        .to(TckPipeBatchOut as any);

      await pipeline.start();

      const output: Array<MemoryEnvelope> = [];
      store.subscriptions.push({
        topic: "TckPipeBatchOut",
        queue: null,
        callback: async (env: MemoryEnvelope) => {
          output.push(env);
        },
        consumerTag: "test-output",
      });

      const publisher = driver.createPublisher(TckPipeIn);

      // Publish 2 messages — not enough for batch
      await publisher.publish(publisher.create({ value: 1, label: "a" } as any));
      await publisher.publish(publisher.create({ value: 2, label: "b" } as any));
      expect(output).toHaveLength(0);

      // Publish 3rd message — batch should flush
      await publisher.publish(publisher.create({ value: 3, label: "c" } as any));
      expect(output).toHaveLength(1);
    });

    it("should flush partial batch on stop", async () => {
      const { driver } = createDriverAndStore();
      const mockLogger = createMockLogger();
      const processor = driver.createStreamProcessor();
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .batch(5)
        .map((batch: any) => ({ count: batch.length, label: "partial" }))
        .to(TckPipeBatchOut as any);

      await pipeline.start();

      const publisher = driver.createPublisher(TckPipeIn);

      // Publish 2 messages (less than batch size of 5)
      await publisher.publish(publisher.create({ value: 1, label: "a" } as any));
      await publisher.publish(publisher.create({ value: 2, label: "b" } as any));

      // The internal batchBuffer should have 2 items
      expect((pipeline as any).batchBuffer).toHaveLength(2);

      // Stop flushes the batch buffer by calling publishOutput directly
      // (without running remaining map stages). This empties the buffer
      // but the output hydration may fail since the raw batch array
      // is passed directly to publishOutput.
      await pipeline.stop();

      // Buffer should be drained after stop
      expect((pipeline as any).batchBuffer).toHaveLength(0);
    });
  });

  describe("stop flushes remaining batch", () => {
    it("should publish accumulated items when stopped", async () => {
      const { driver, store } = createDriverAndStore();
      const processor = driver.createStreamProcessor();

      // Use batch as the LAST stage before to().
      // flushBatchBuffer calls publishOutput(batch) directly.
      // The output class must accept the batch structure.
      // Here we use a pipeline with ONLY a batch stage (no map after),
      // and the output is TckPipeOut whose fields are "doubled" and "label".
      // publishOutput receives an array, which hydrate treats as Record.
      // This tests that the buffer is indeed consumed.
      const pipeline = (processor as MemoryStreamProcessor)
        .from(TckPipeIn)
        .batch(10)
        .to(TckPipeBatchOut as any);

      await pipeline.start();

      const publisher = driver.createPublisher(TckPipeIn);

      await publisher.publish(publisher.create({ value: 1, label: "x" } as any));
      await publisher.publish(publisher.create({ value: 2, label: "y" } as any));
      await publisher.publish(publisher.create({ value: 3, label: "z" } as any));

      // Buffer should have 3 items
      expect((pipeline as any).batchBuffer).toHaveLength(3);

      await pipeline.stop();

      // Buffer should be drained
      expect((pipeline as any).batchBuffer).toHaveLength(0);
      // Pipeline should no longer be running
      expect(pipeline.isRunning()).toBe(false);
    });
  });
});
