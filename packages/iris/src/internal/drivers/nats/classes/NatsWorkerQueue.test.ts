import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { NatsSharedState, NatsConsumerLoop } from "../types/nats-types";
import { NatsWorkerQueue } from "./NatsWorkerQueue";

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

@Message({ name: "TckNatsWqBasic" })
class TckNatsWqBasic implements IMessage {
  @Field("string") data!: string;
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

const createQueue = () => {
  const state = createMockState();
  const queue = new NatsWorkerQueue<TckNatsWqBasic>({
    target: TckNatsWqBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { queue, state };
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
    consumerName: "iris_worker_my-queue",
    subject: "iris.my-queue",
    messages: null,
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    ready: Promise.resolve(),
  };
});

describe("NatsWorkerQueue", () => {
  describe("publish", () => {
    it("should call publishNatsMessages", async () => {
      const { queue } = createQueue();
      const msg = queue.create({ data: "test" });
      await queue.publish(msg);
      expect(mockPublishNatsMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe("consume", () => {
    it("should create consumer loops with string queue argument", async () => {
      const { queue } = createQueue();

      await queue.consume("my-queue", async () => {});

      // Creates 2 consumers: main (competing consumer) + broadcast
      expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(2);
      const mainOpts = mockCreateNatsConsumer.mock.calls[0][0];
      expect(mainOpts.subject).toBe("iris.my-queue");
      expect(mainOpts.consumerName).toBe("iris_worker_my-queue");
      expect(mainOpts.deliverPolicy).toBe("all");

      const broadcastOpts = mockCreateNatsConsumer.mock.calls[1][0];
      expect(broadcastOpts.subject).toBe("iris.my-queue.broadcast");
      expect(broadcastOpts.consumerName).toContain("iris_worker_my-queue_bc_");
      expect(broadcastOpts.deliverPolicy).toBe("new");
    });

    it("should create consumer loops with options object", async () => {
      const { queue } = createQueue();

      await queue.consume({
        queue: "my-queue",
        callback: async () => {},
      });

      // Creates 2 consumers: main + broadcast
      expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(2);
    });

    it("should throw when callback is missing", async () => {
      const { queue } = createQueue();
      await expect(queue.consume("my-queue")).rejects.toThrow(
        "consume() requires a callback",
      );
    });

    it("should throw when connection is not available", async () => {
      const { queue, state } = createQueue();
      state.js = null;

      await expect(queue.consume("my-queue", async () => {})).rejects.toThrow(
        "Cannot consume: connection is not available",
      );
    });

    it("should register both consumers in state.consumerRegistrations", async () => {
      const { queue, state } = createQueue();

      await queue.consume("my-queue", async () => {});

      expect(state.consumerRegistrations).toHaveLength(2);
      expect(state.consumerRegistrations[0].deliverPolicy).toBe("all");
      expect(state.consumerRegistrations[1].deliverPolicy).toBe("new");
    });

    it("should handle array of consume options", async () => {
      const { queue } = createQueue();

      await queue.consume([
        { queue: "q1", callback: async () => {} },
        { queue: "q2", callback: async () => {} },
      ]);

      // 2 queues x 2 consumers each = 4
      expect(mockCreateNatsConsumer).toHaveBeenCalledTimes(4);
    });
  });

  describe("unconsume", () => {
    it("should stop both consumer loops for specified queue", async () => {
      const { queue, state } = createQueue();

      await queue.consume("my-queue", async () => {});

      await queue.unconsume("my-queue");

      // stopNatsConsumer called for main + broadcast
      expect(mockStopNatsConsumer).toHaveBeenCalledTimes(2);
    });

    it("should remove consumer registrations on unconsume", async () => {
      const { queue, state } = createQueue();

      await queue.consume("my-queue", async () => {});
      expect(state.consumerRegistrations).toHaveLength(2);

      await queue.unconsume("my-queue");
      expect(state.consumerRegistrations).toHaveLength(0);
    });

    it("should be a no-op for unknown queue", async () => {
      const { queue } = createQueue();
      await expect(queue.unconsume("unknown")).resolves.toBeUndefined();
    });
  });

  describe("unconsumeAll", () => {
    it("should stop all owned consumer loops", async () => {
      const { queue } = createQueue();

      mockCreateNatsConsumerResult = {
        consumerTag: "ctag-a",
        streamName: "IRIS_IRIS",
        consumerName: "iris_worker_q1",
        subject: "iris.q1",
        messages: null,
        abortController: new AbortController(),
        loopPromise: Promise.resolve(),
        ready: Promise.resolve(),
      };
      await queue.consume("q1", async () => {});

      mockCreateNatsConsumerResult = {
        consumerTag: "ctag-b",
        streamName: "IRIS_IRIS",
        consumerName: "iris_worker_q2",
        subject: "iris.q2",
        messages: null,
        abortController: new AbortController(),
        loopPromise: Promise.resolve(),
        ready: Promise.resolve(),
      };
      await queue.consume("q2", async () => {});

      await queue.unconsumeAll();

      // 2 queues x 2 consumers each = 4 stop calls
      expect(mockStopNatsConsumer).toHaveBeenCalledTimes(4);
    });
  });
});
