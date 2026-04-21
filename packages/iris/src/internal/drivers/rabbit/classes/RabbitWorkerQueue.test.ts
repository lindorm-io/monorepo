import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RabbitSharedState } from "../types/rabbit-types";
import { RabbitWorkerQueue } from "./RabbitWorkerQueue";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mocks ---
const mockPublishRabbitMessages = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/publish-messages", async () => ({
  publishRabbitMessages: (...args: Array<unknown>) => mockPublishRabbitMessages(...args),
}));

const mockWrapRabbitConsumer = vi.fn().mockReturnValue(vi.fn());
vi.mock("../utils/wrap-rabbit-consumer", () => ({
  wrapRabbitConsumer: (...args: Array<unknown>) => mockWrapRabbitConsumer(...args),
}));

// --- Test message ---

@Message({ name: "TckRabbitWqBasic" })
class TckRabbitWqBasic implements IMessage {
  @Field("string") data!: string;
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
    .mockResolvedValue({ queue: "amq.gen-ephemeral", messageCount: 0, consumerCount: 0 }),
  bindQueue: vi.fn().mockResolvedValue(undefined),
  consume: vi.fn().mockResolvedValue({ consumerTag: "ctag-1" }),
  cancel: vi.fn().mockResolvedValue(undefined),
  unbindQueue: vi.fn().mockResolvedValue(undefined),
  ack: vi.fn(),
  nack: vi.fn(),
});

const createMockState = (overrides?: Partial<RabbitSharedState>): RabbitSharedState => ({
  connection: {} as any,
  publishChannel: { publish: vi.fn() } as any,
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

const createQueue = (stateOverrides?: Partial<RabbitSharedState>) => {
  const state = createMockState(stateOverrides);
  const queue = new RabbitWorkerQueue<TckRabbitWqBasic>({
    target: TckRabbitWqBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { queue, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockPublishRabbitMessages.mockClear();
  mockWrapRabbitConsumer.mockClear();
});

describe("RabbitWorkerQueue", () => {
  describe("publish", () => {
    it("should call publishRabbitMessages", async () => {
      const { queue } = createQueue();
      const msg = queue.create({ data: "test" });
      await queue.publish(msg);
      expect(mockPublishRabbitMessages).toHaveBeenCalledTimes(1);
    });

    it("should pass options through", async () => {
      const { queue } = createQueue();
      const msg = queue.create({ data: "test" });
      await queue.publish(msg, { delay: 2000 });
      expect(mockPublishRabbitMessages.mock.calls[0][1]).toEqual({ delay: 2000 });
    });
  });

  describe("consume", () => {
    it("should assert durable queue and bind with string queue argument", async () => {
      const { queue, state } = createQueue();
      const channel = state.consumeChannel!;

      await queue.consume("my-queue", async () => {});

      expect(channel.assertQueue).toHaveBeenCalledWith("test-exchange.wq.my-queue", {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "test-exchange.dlx",
        },
      });
      expect(channel.bindQueue).toHaveBeenCalledWith(
        "test-exchange.wq.my-queue",
        "test-exchange",
        "my-queue",
      );
    });

    it("should consume on the channel with wrapped callback", async () => {
      const { queue, state } = createQueue();
      const channel = state.consumeChannel!;

      await queue.consume("my-queue", async () => {});

      expect(mockWrapRabbitConsumer).toHaveBeenCalledTimes(1);
      expect(channel.consume).toHaveBeenCalledTimes(1);
    });

    it("should register consumer in state.consumerRegistrations", async () => {
      const { queue, state } = createQueue();

      await queue.consume("my-queue", async () => {});

      expect(state.consumerRegistrations).toHaveLength(1);
      expect(state.consumerRegistrations[0]).toMatchSnapshot();
    });

    it("should accept options object form", async () => {
      const { queue, state } = createQueue();
      const channel = state.consumeChannel!;

      await queue.consume({
        queue: "my-queue",
        callback: async () => {},
      });

      expect(channel.consume).toHaveBeenCalledTimes(1);
      expect(state.consumerRegistrations).toHaveLength(1);
    });

    it("should accept an array of consume options", async () => {
      const { queue, state } = createQueue();
      const channel = state.consumeChannel!;

      let ctagCounter = 0;
      (channel.consume as Mock).mockImplementation(async () => ({
        consumerTag: `ctag-${++ctagCounter}`,
      }));

      await queue.consume([
        { queue: "q1", callback: async () => {} },
        { queue: "q2", callback: async () => {} },
      ]);

      expect(channel.consume).toHaveBeenCalledTimes(2);
      expect(state.consumerRegistrations).toHaveLength(2);
    });

    it("should throw when callback is missing", async () => {
      const { queue } = createQueue();
      await expect(queue.consume("my-queue")).rejects.toThrow(
        "consume() requires a callback",
      );
    });

    it("should throw when consume channel is not available", async () => {
      const { queue } = createQueue({ consumeChannel: null });

      await expect(queue.consume("my-queue", async () => {})).rejects.toThrow(
        "Cannot consume: consume channel is not available",
      );
    });

    it("should not re-assert queue if already asserted", async () => {
      const { queue, state } = createQueue();
      state.assertedQueues.add("test-exchange.wq.my-queue");
      const channel = state.consumeChannel!;

      await queue.consume("my-queue", async () => {});

      expect(channel.assertQueue).not.toHaveBeenCalled();
      expect(channel.bindQueue).not.toHaveBeenCalled();
      expect(channel.consume).toHaveBeenCalledTimes(1);
    });

    it("should add queue name to assertedQueues", async () => {
      const { queue, state } = createQueue();

      await queue.consume("my-queue", async () => {});

      expect(state.assertedQueues.has("test-exchange.wq.my-queue")).toBe(true);
    });
  });

  describe("unconsume", () => {
    it("should cancel consumer and unbind queue", async () => {
      const { queue, state } = createQueue();
      const channel = state.consumeChannel!;

      await queue.consume("my-queue", async () => {});

      await queue.unconsume("my-queue");

      expect(channel.unbindQueue).toHaveBeenCalled();
      expect(channel.cancel).toHaveBeenCalledWith("ctag-1");
    });

    it("should remove from consumerRegistrations and assertedQueues", async () => {
      const { queue, state } = createQueue();

      await queue.consume("my-queue", async () => {});

      expect(state.consumerRegistrations).toHaveLength(1);
      expect(state.assertedQueues.has("test-exchange.wq.my-queue")).toBe(true);

      await queue.unconsume("my-queue");

      expect(state.consumerRegistrations).toHaveLength(0);
      expect(state.assertedQueues.has("test-exchange.wq.my-queue")).toBe(false);
    });

    it("should be a no-op for unknown queue", async () => {
      const { queue } = createQueue();
      await expect(queue.unconsume("unknown")).resolves.toBeUndefined();
    });

    it("should handle channel errors gracefully", async () => {
      const { queue, state } = createQueue();
      const channel = state.consumeChannel!;

      await queue.consume("my-queue", async () => {});

      (channel.unbindQueue as Mock).mockRejectedValueOnce(new Error("gone"));
      (channel.cancel as Mock).mockRejectedValueOnce(new Error("gone"));

      await expect(queue.unconsume("my-queue")).resolves.toBeUndefined();
    });
  });

  describe("unconsumeAll", () => {
    it("should cancel all owned consumers", async () => {
      const { queue, state } = createQueue();
      const channel = state.consumeChannel!;

      let ctagCounter = 0;
      (channel.consume as Mock).mockImplementation(async () => ({
        consumerTag: `ctag-${++ctagCounter}`,
      }));

      await queue.consume("q1", async () => {});
      await queue.consume("q2", async () => {});

      expect(state.consumerRegistrations).toHaveLength(2);

      await queue.unconsumeAll();

      expect(state.consumerRegistrations).toHaveLength(0);
      expect(channel.cancel).toHaveBeenCalledTimes(2);
    });

    it("should handle channel errors gracefully", async () => {
      const { queue, state } = createQueue();
      const channel = state.consumeChannel!;

      await queue.consume("q1", async () => {});

      (channel.unbindQueue as Mock).mockRejectedValue(new Error("gone"));
      (channel.cancel as Mock).mockRejectedValue(new Error("gone"));

      await expect(queue.unconsumeAll()).resolves.toBeUndefined();
    });

    it("should work when channel is null", async () => {
      const { queue, state } = createQueue();

      await queue.consume("q1", async () => {});

      state.consumeChannel = null;

      await expect(queue.unconsumeAll()).resolves.toBeUndefined();
    });
  });
});
