import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { RabbitMessageBus } from "./RabbitMessageBus.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mocks ---
const mockPublishRabbitMessages = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/publish-messages.js", async () => ({
  publishRabbitMessages: (...args: Array<unknown>) => mockPublishRabbitMessages(...args),
}));

const mockWrapRabbitConsumer = vi.fn().mockReturnValue(vi.fn());
vi.mock("../utils/wrap-rabbit-consumer.js", () => ({
  wrapRabbitConsumer: (...args: Array<unknown>) => mockWrapRabbitConsumer(...args),
}));

// --- Test message ---

@Message({ name: "TckRabbitBusBasic" })
class TckRabbitBusBasic implements IMessage {
  @Field("string") body!: string;
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

const createBus = (stateOverrides?: Partial<RabbitSharedState>) => {
  const state = createMockState(stateOverrides);
  const bus = new RabbitMessageBus<TckRabbitBusBasic>({
    target: TckRabbitBusBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { bus, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockPublishRabbitMessages.mockClear();
  mockWrapRabbitConsumer.mockClear();
});

describe("RabbitMessageBus", () => {
  describe("publish", () => {
    it("should call publishRabbitMessages", async () => {
      const { bus } = createBus();
      const msg = bus.create({ body: "hello" });
      await bus.publish(msg);
      expect(mockPublishRabbitMessages).toHaveBeenCalledTimes(1);
    });

    it("should pass state and logger to publishRabbitMessages", async () => {
      const { bus, state } = createBus();
      const msg = bus.create({ body: "test" });
      await bus.publish(msg);
      expect(mockPublishRabbitMessages.mock.calls[0][3]).toBe(state);
    });

    it("should pass options through to publishRabbitMessages", async () => {
      const { bus } = createBus();
      const msg = bus.create({ body: "test" });
      await bus.publish(msg, { delay: 5000 });
      expect(mockPublishRabbitMessages.mock.calls[0][1]).toEqual({ delay: 5000 });
    });

    it("should forward array of messages", async () => {
      const { bus } = createBus();
      const msg1 = bus.create({ body: "first" });
      const msg2 = bus.create({ body: "second" });
      await bus.publish([msg1, msg2]);
      expect(mockPublishRabbitMessages).toHaveBeenCalledTimes(1);
      expect(mockPublishRabbitMessages.mock.calls[0][0]).toEqual([msg1, msg2]);
    });
  });

  describe("subscribe", () => {
    it("should assert named queue and bind to exchange when queue is specified", async () => {
      const { bus, state } = createBus();
      const channel = state.consumeChannel!;

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(channel.assertQueue).toHaveBeenCalledWith(
        "test-exchange.TckRabbitBusBasic.q1",
        { durable: true },
      );
      expect(channel.bindQueue).toHaveBeenCalledWith(
        "test-exchange.TckRabbitBusBasic.q1",
        "test-exchange",
        "TckRabbitBusBasic",
      );
    });

    it("should assert ephemeral queue when no queue is specified", async () => {
      const { bus, state } = createBus();
      const channel = state.consumeChannel!;

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        callback: async () => {},
      });

      expect(channel.assertQueue).toHaveBeenCalledWith("", {
        exclusive: true,
        autoDelete: true,
      });
      expect(channel.bindQueue).toHaveBeenCalledWith(
        "amq.gen-ephemeral",
        "test-exchange",
        "TckRabbitBusBasic",
      );
    });

    it("should call wrapRabbitConsumer and consume on channel", async () => {
      const { bus, state } = createBus();
      const channel = state.consumeChannel!;

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(mockWrapRabbitConsumer).toHaveBeenCalledTimes(1);
      expect(channel.consume).toHaveBeenCalledTimes(1);
    });

    it("should register consumer in state.consumerRegistrations", async () => {
      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(state.consumerRegistrations).toHaveLength(1);
      expect(state.consumerRegistrations[0]).toMatchSnapshot();
    });

    it("should not re-assert queue if already asserted", async () => {
      const { bus, state } = createBus();
      state.assertedQueues.add("test-exchange.TckRabbitBusBasic.q1");
      const channel = state.consumeChannel!;

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(channel.assertQueue).not.toHaveBeenCalled();
      expect(channel.bindQueue).not.toHaveBeenCalled();
      expect(channel.consume).toHaveBeenCalledTimes(1);
    });

    it("should throw when consume channel is not available", async () => {
      const { bus } = createBus({ consumeChannel: null });

      await expect(
        bus.subscribe({ topic: "TckRabbitBusBasic", callback: async () => {} }),
      ).rejects.toThrow("Cannot subscribe: consume channel is not available");
    });

    it("should accept an array of subscriptions", async () => {
      const { bus, state } = createBus();
      const channel = state.consumeChannel!;

      await bus.subscribe([
        { topic: "TckRabbitBusBasic", queue: "q1", callback: async () => {} },
        { topic: "TckRabbitBusBasic", queue: "q2", callback: async () => {} },
      ]);

      expect(channel.consume).toHaveBeenCalledTimes(2);
      expect(state.consumerRegistrations).toHaveLength(2);
    });

    it("should handle empty array without error", async () => {
      const { bus, state } = createBus();

      await bus.subscribe([]);

      expect(state.consumerRegistrations).toHaveLength(0);
    });
  });

  describe("unsubscribe", () => {
    it("should cancel consumer and unbind queue", async () => {
      const { bus, state } = createBus();
      const channel = state.consumeChannel!;

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      await bus.unsubscribe({ topic: "TckRabbitBusBasic", queue: "q1" });

      expect(channel.unbindQueue).toHaveBeenCalled();
      expect(channel.cancel).toHaveBeenCalledWith("ctag-1");
    });

    it("should remove from consumerRegistrations and assertedQueues", async () => {
      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(state.consumerRegistrations).toHaveLength(1);

      await bus.unsubscribe({ topic: "TckRabbitBusBasic", queue: "q1" });

      expect(state.consumerRegistrations).toHaveLength(0);
    });

    it("should be a no-op for unknown subscription", async () => {
      const { bus } = createBus();
      await expect(bus.unsubscribe({ topic: "unknown" })).resolves.toBeUndefined();
    });

    it("should handle channel errors gracefully during unbind/cancel", async () => {
      const { bus, state } = createBus();
      const channel = state.consumeChannel!;

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      (channel.unbindQueue as Mock).mockRejectedValueOnce(new Error("queue gone"));
      (channel.cancel as Mock).mockRejectedValueOnce(new Error("consumer gone"));

      await expect(
        bus.unsubscribe({ topic: "TckRabbitBusBasic", queue: "q1" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("unsubscribeAll", () => {
    it("should cancel all owned consumers", async () => {
      const { bus, state } = createBus();
      const channel = state.consumeChannel!;

      let ctagCounter = 0;
      (channel.consume as Mock).mockImplementation(async () => ({
        consumerTag: `ctag-${++ctagCounter}`,
      }));

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });
      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q2",
        callback: async () => {},
      });

      expect(state.consumerRegistrations).toHaveLength(2);

      await bus.unsubscribeAll();

      expect(state.consumerRegistrations).toHaveLength(0);
      expect(channel.cancel).toHaveBeenCalledTimes(2);
    });

    it("should handle channel errors gracefully", async () => {
      const { bus, state } = createBus();
      const channel = state.consumeChannel!;

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        callback: async () => {},
      });

      (channel.unbindQueue as Mock).mockRejectedValue(new Error("gone"));
      (channel.cancel as Mock).mockRejectedValue(new Error("gone"));

      await expect(bus.unsubscribeAll()).resolves.toBeUndefined();
    });

    it("should work when channel is null", async () => {
      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckRabbitBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      // Set channel to null after subscribing
      state.consumeChannel = null;

      await expect(bus.unsubscribeAll()).resolves.toBeUndefined();
    });
  });
});
