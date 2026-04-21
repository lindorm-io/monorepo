import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { RabbitStreamPipeline } from "./RabbitStreamPipeline.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mocks ---
vi.mock("../utils/build-amqp-headers.js", async () => ({
  buildAmqpHeaders: vi.fn().mockReturnValue({
    properties: {
      headers: {},
      contentType: "application/octet-stream",
    },
    routingKey: "TckRabbitPlIn",
  }),
}));

vi.mock("../utils/parse-amqp-headers.js", () => ({
  parseAmqpHeaders: vi.fn().mockReturnValue({
    payload: Buffer.from("{}"),
    headers: {},
    envelope: { topic: "TckRabbitPlIn" },
  }),
}));

// --- Test messages ---

@Message({ name: "TckRabbitPlIn" })
class TckRabbitPlIn implements IMessage {
  @Field("integer") value!: number;
}

@Message({ name: "TckRabbitPlOut" })
class TckRabbitPlOut implements IMessage {
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

const createMockChannel = () => ({
  assertQueue: vi
    .fn()
    .mockResolvedValue({ queue: "amq.gen-pipeline", messageCount: 0, consumerCount: 0 }),
  bindQueue: vi.fn().mockResolvedValue(undefined),
  consume: vi.fn().mockResolvedValue({ consumerTag: "pl-ctag" }),
  cancel: vi.fn().mockResolvedValue(undefined),
  unbindQueue: vi.fn().mockResolvedValue(undefined),
  ack: vi.fn(),
  nack: vi.fn(),
});

const createMockState = (overrides?: Partial<RabbitSharedState>): RabbitSharedState => ({
  connection: {} as any,
  publishChannel: {
    publish: vi.fn((_ex, _rk, _buf, _opts, cb) => {
      process.nextTick(() => cb?.(null));
      return true;
    }),
  } as any,
  consumeChannel: createMockChannel() as any,
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
  ...overrides,
});

const createPipeline = (opts?: {
  stateOverrides?: Partial<RabbitSharedState>;
  inputClass?: any;
  noInputClass?: boolean;
  stages?: Array<any>;
}) => {
  const state = createMockState(opts?.stateOverrides);
  const pipeline = new RabbitStreamPipeline({
    state,
    logger: createMockLogger() as any,
    stages: opts?.stages ?? [],
    inputClass: opts?.noInputClass
      ? undefined
      : (opts?.inputClass ?? (TckRabbitPlIn as any)),
    outputClass: TckRabbitPlOut as any,
  });
  return { pipeline, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
});

describe("RabbitStreamPipeline", () => {
  describe("start", () => {
    it("should assert ephemeral queue and bind to exchange", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();

      expect(channel.assertQueue).toHaveBeenCalledWith("", {
        exclusive: true,
        autoDelete: true,
      });
      expect(channel.bindQueue).toHaveBeenCalledWith(
        "amq.gen-pipeline",
        "test-exchange",
        "TckRabbitPlIn",
      );
    });

    it("should consume on the channel", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();

      expect(channel.consume).toHaveBeenCalledTimes(1);
      expect(channel.consume).toHaveBeenCalledWith(
        "amq.gen-pipeline",
        expect.any(Function),
      );
    });

    it("should register consumer in state.consumerRegistrations", async () => {
      const { pipeline, state } = createPipeline();

      await pipeline.start();

      expect(state.consumerRegistrations).toHaveLength(1);
      expect(state.consumerRegistrations[0]).toMatchSnapshot();
    });

    it("should set running to true", async () => {
      const { pipeline } = createPipeline();

      expect(pipeline.isRunning()).toBe(false);

      await pipeline.start();

      expect(pipeline.isRunning()).toBe(true);
    });

    it("should throw when no input class is provided", async () => {
      const { pipeline } = createPipeline({ noInputClass: true });

      await expect(pipeline.start()).rejects.toThrow(
        "Stream pipeline requires an input class",
      );
    });

    it("should throw when consume channel is not available", async () => {
      const { pipeline } = createPipeline({ stateOverrides: { consumeChannel: null } });

      await expect(pipeline.start()).rejects.toThrow(
        "Cannot start stream pipeline: consume channel is not available",
      );
    });

    it("should be a no-op when already running and consumer still exists", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();

      // Add the consumer tag to registrations so it finds it
      expect(state.consumerRegistrations).toHaveLength(1);

      await pipeline.start();

      // Should only have called consume once
      expect(channel.consume).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("should cancel consumer and clean up registrations", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();

      expect(state.consumerRegistrations).toHaveLength(1);

      await pipeline.stop();

      expect(channel.cancel).toHaveBeenCalledWith("pl-ctag");
      expect(state.consumerRegistrations).toHaveLength(0);
      expect(pipeline.isRunning()).toBe(false);
    });

    it("should be a no-op when not running", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.stop();

      expect(channel.cancel).not.toHaveBeenCalled();
    });

    it("should handle channel errors gracefully on stop", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();

      (channel.cancel as Mock).mockRejectedValueOnce(new Error("channel closed"));

      await expect(pipeline.stop()).resolves.toBeUndefined();
    });
  });

  describe("pause and resume", () => {
    it("should pause by cancelling consumer", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();

      expect(pipeline.isRunning()).toBe(true);

      await pipeline.pause();

      expect(pipeline.isRunning()).toBe(false);
      expect(channel.cancel).toHaveBeenCalledWith("pl-ctag");
      expect(channel.unbindQueue).toHaveBeenCalled();
      expect(state.consumerRegistrations).toHaveLength(0);
    });

    it("should resume by creating a new consumer", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      let ctagCounter = 0;
      (channel.consume as Mock).mockImplementation(async () => ({
        consumerTag: `pl-ctag-${++ctagCounter}`,
      }));

      await pipeline.start();
      await pipeline.pause();

      (channel.assertQueue as Mock).mockResolvedValue({ queue: "amq.gen-resumed" });

      await pipeline.resume();

      expect(pipeline.isRunning()).toBe(true);
      // assertQueue called: once for start, once for resume
      expect(channel.assertQueue).toHaveBeenCalledTimes(2);
      // consume called: once for start, once for resume
      expect(channel.consume).toHaveBeenCalledTimes(2);
      expect(state.consumerRegistrations).toHaveLength(1);
    });

    it("should be a no-op to pause when already paused", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();
      await pipeline.pause();

      const cancelCount = (channel.cancel as Mock).mock.calls.length;

      await pipeline.pause();

      expect((channel.cancel as Mock).mock.calls.length).toBe(cancelCount);
    });

    it("should be a no-op to resume when not paused", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();

      const consumeCount = (channel.consume as Mock).mock.calls.length;

      await pipeline.resume();

      expect((channel.consume as Mock).mock.calls.length).toBe(consumeCount);
    });

    it("should warn and not create consumer when resume has no channel", async () => {
      const { pipeline, state } = createPipeline();
      const channel = state.consumeChannel!;

      await pipeline.start();

      const consumeCountAfterStart = (channel.consume as Mock).mock.calls.length;

      await pipeline.pause();

      state.consumeChannel = null;

      await pipeline.resume();

      // No new consumer was created since channel is null
      expect((channel.consume as Mock).mock.calls.length).toBe(consumeCountAfterStart);
    });
  });
});
