import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { NatsSharedState, NatsConsumerLoop } from "../types/nats-types";
import { NatsMessageBus } from "./NatsMessageBus";

// --- Mocks ---
const mockPublishNatsMessages = jest.fn().mockResolvedValue(undefined);
jest.mock("../utils/publish-nats-messages", () => ({
  publishNatsMessages: (...args: Array<unknown>) => mockPublishNatsMessages(...args),
}));

const mockWrapNatsConsumer = jest.fn().mockReturnValue(jest.fn());
jest.mock("../utils/wrap-nats-consumer", () => ({
  wrapNatsConsumer: (...args: Array<unknown>) => mockWrapNatsConsumer(...args),
}));

let mockCreateNatsConsumerResult: Partial<NatsConsumerLoop>;
const mockCreateNatsConsumer = jest
  .fn()
  .mockImplementation(async () => mockCreateNatsConsumerResult);
jest.mock("../utils/create-nats-consumer", () => ({
  createNatsConsumer: (...args: Array<unknown>) => mockCreateNatsConsumer(...args),
}));

const mockStopNatsConsumer = jest.fn().mockResolvedValue(undefined);
jest.mock("../utils/stop-nats-consumer", () => ({
  stopNatsConsumer: (...args: Array<unknown>) => mockStopNatsConsumer(...args),
}));

// --- Test message ---

@Message({ name: "TckNatsBusBasic" })
class TckNatsBusBasic implements IMessage {
  @Field("string") body!: string;
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

const createMockState = (): NatsSharedState => ({
  nc: {} as any,
  js: {
    publish: jest
      .fn()
      .mockResolvedValue({ seq: 1, stream: "IRIS_IRIS", duplicate: false }),
    consumers: { get: jest.fn() },
  } as any,
  jsm: {
    streams: { info: jest.fn(), add: jest.fn(), purge: jest.fn() },
    consumers: {
      add: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
    },
  } as any,
  headersInit: jest
    .fn()
    .mockReturnValue({
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      values: jest.fn(),
    }) as any,
  prefix: "iris",
  streamName: "IRIS_IRIS",
  consumerLoops: [],
  consumerRegistrations: [],
  ensuredConsumers: new Set(),
  inFlightCount: 0,
  prefetch: 10,
});

const createBus = () => {
  const state = createMockState();
  const bus = new NatsMessageBus<TckNatsBusBasic>({
    target: TckNatsBusBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { bus, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockPublishNatsMessages.mockClear();
  mockWrapNatsConsumer.mockClear();
  mockCreateNatsConsumer.mockClear();
  mockStopNatsConsumer.mockClear();
  mockCreateNatsConsumerResult = {
    consumerTag: "ctag-1",
    streamName: "IRIS_IRIS",
    consumerName: "iris_subscribe_TckNatsBusBasic_q1",
    subject: "iris.TckNatsBusBasic",
    messages: null,
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    ready: Promise.resolve(),
  };
});

describe("NatsMessageBus", () => {
  describe("publish", () => {
    it("should call publishNatsMessages", async () => {
      const { bus } = createBus();
      const msg = bus.create({ body: "hello" });
      await bus.publish(msg);
      expect(mockPublishNatsMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribe", () => {
    it("should create consumer with correct subject and consumer name", async () => {
      const { bus } = createBus();

      await bus.subscribe({
        topic: "TckNatsBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(1);
      const opts = mockCreateNatsConsumer.mock.calls[0][0];
      expect(opts.subject).toBe("iris.TckNatsBusBasic");
      expect(opts.consumerName).toBe("iris_subscribe_TckNatsBusBasic_q1");
      expect(opts.deliverPolicy).toBe("new");
    });

    it("should create ephemeral consumer name when no queue specified", async () => {
      const { bus } = createBus();

      await bus.subscribe({
        topic: "TckNatsBusBasic",
        callback: async () => {},
      });

      expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(1);
      const opts = mockCreateNatsConsumer.mock.calls[0][0];
      expect(opts.consumerName).toMatch(/^iris_sub_ephemeral_/);
    });

    it("should throw when no connection available", async () => {
      const { bus, state } = createBus();
      state.js = null;

      await expect(
        bus.subscribe({ topic: "TckNatsBusBasic", callback: async () => {} }),
      ).rejects.toThrow("Cannot subscribe: connection is not available");
    });

    it("should register consumer in state.consumerRegistrations", async () => {
      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckNatsBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(state.consumerRegistrations).toHaveLength(1);
      expect(state.consumerRegistrations[0].consumerTag).toBe("ctag-1");
      expect(state.consumerRegistrations[0].subject).toBe("iris.TckNatsBusBasic");
    });

    it("should handle array of subscribe options", async () => {
      const { bus } = createBus();

      await bus.subscribe([
        { topic: "TckNatsBusBasic", queue: "q1", callback: async () => {} },
        { topic: "TckNatsBusBasic", queue: "q2", callback: async () => {} },
      ]);

      expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(2);
    });
  });

  describe("unsubscribe", () => {
    it("should stop the consumer loop", async () => {
      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckNatsBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      await bus.unsubscribe({ topic: "TckNatsBusBasic", queue: "q1" });

      expect(mockStopNatsConsumer).toHaveBeenCalledTimes(1);
      expect(mockStopNatsConsumer).toHaveBeenCalledWith(state, "ctag-1");
    });

    it("should remove consumer registration on unsubscribe", async () => {
      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckNatsBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(state.consumerRegistrations).toHaveLength(1);

      await bus.unsubscribe({ topic: "TckNatsBusBasic", queue: "q1" });

      expect(state.consumerRegistrations).toHaveLength(0);
    });

    it("should clean up ephemeral consumer from ensuredConsumers on unsubscribe without queue", async () => {
      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckNatsBusBasic",
        callback: async () => {},
      });

      const consumerName = mockCreateNatsConsumer.mock.calls[0][0].consumerName;
      state.ensuredConsumers.add(consumerName);

      await bus.unsubscribe({ topic: "TckNatsBusBasic" });

      expect(state.ensuredConsumers.has(consumerName)).toBe(false);
    });

    it("should be a no-op for unknown subscription", async () => {
      const { bus } = createBus();
      await expect(
        bus.unsubscribe({ topic: "unknown", queue: "q1" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("unsubscribeAll", () => {
    it("should stop all owned consumer loops", async () => {
      const { bus, state } = createBus();

      mockCreateNatsConsumerResult = {
        consumerTag: "ctag-a",
        streamName: "IRIS_IRIS",
        consumerName: "iris_subscribe_TckNatsBusBasic_q1",
        subject: "iris.TckNatsBusBasic",
        messages: null,
        abortController: new AbortController(),
        loopPromise: Promise.resolve(),
        ready: Promise.resolve(),
      };

      await bus.subscribe({
        topic: "TckNatsBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      mockCreateNatsConsumerResult = {
        consumerTag: "ctag-b",
        streamName: "IRIS_IRIS",
        consumerName: "iris_subscribe_TckNatsBusBasic_q2",
        subject: "iris.TckNatsBusBasic",
        messages: null,
        abortController: new AbortController(),
        loopPromise: Promise.resolve(),
        ready: Promise.resolve(),
      };

      await bus.subscribe({
        topic: "TckNatsBusBasic",
        queue: "q2",
        callback: async () => {},
      });

      await bus.unsubscribeAll();

      expect(mockStopNatsConsumer).toHaveBeenCalledTimes(2);
      expect(mockStopNatsConsumer).toHaveBeenCalledWith(state, "ctag-a");
      expect(mockStopNatsConsumer).toHaveBeenCalledWith(state, "ctag-b");
    });
  });
});
