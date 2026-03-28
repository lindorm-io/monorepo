import type { IMessage, IMessageSubscriber } from "../../../../interfaces";
import { Broadcast } from "../../../../decorators/Broadcast";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { Topic } from "../../../../decorators/Topic";
import { clearRegistry } from "../../../message/metadata/registry";
import type { DelayManager } from "../../../delay/DelayManager";
import type { MemorySharedState } from "../types/memory-store";
import { createStore } from "../utils/create-store";
import { MemoryPublisher } from "./MemoryPublisher";

// --- Test message classes ---

@Message({ name: "TckPubBasic" })
class TckPubBasic implements IMessage {
  @Field("string") body!: string;
}

@Topic((msg: any) => `events.${msg.category}`)
@Message({ name: "TckPubTopicMsg" })
class TckPubTopicMsg implements IMessage {
  @Field("string") category!: string;
  @Field("string") data!: string;
}

@Broadcast()
@Message({ name: "TckPubBroadcastMsg" })
class TckPubBroadcastMsg implements IMessage {
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

const createMockDelayManager = (): DelayManager & { scheduledCalls: Array<any> } => {
  const scheduledCalls: Array<any> = [];
  return {
    scheduledCalls,
    schedule: jest.fn(async (envelope: any, topic: string, delayMs: number) => {
      scheduledCalls.push({ envelope, topic, delayMs });
      return "delay-id";
    }),
    cancel: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    size: jest.fn(),
    close: jest.fn(),
  } as any;
};

const createPublisher = <M extends IMessage>(
  target: any,
  opts?: {
    subscribers?: Array<IMessageSubscriber>;
    store?: MemorySharedState;
    delayManager?: DelayManager;
  },
) => {
  const store = opts?.store ?? createStore();
  const subscribers = opts?.subscribers ?? [];
  const publisher = new MemoryPublisher<M>({
    target,
    logger: createMockLogger() as any,
    getSubscribers: () => subscribers,
    store,
    delayManager: opts?.delayManager,
  });
  return { publisher, store };
};

// --- Tests ---

describe("MemoryPublisher", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("publish single message", () => {
    it("should dispatch to matching subscribers", async () => {
      const { publisher, store } = createPublisher(TckPubBasic);

      const received: Array<any> = [];
      store.subscriptions.push({
        topic: "TckPubBasic",
        queue: null,
        callback: async (envelope) => {
          received.push(envelope);
        },
        consumerTag: "test-sub",
      });

      const msg = publisher.create({ body: "hello" } as any);
      await publisher.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].topic).toBe("TckPubBasic");
    });

    it("should dispatch to matching consumers", async () => {
      const { publisher, store } = createPublisher(TckPubBasic);

      const received: Array<any> = [];
      store.consumers.push({
        topic: "TckPubBasic",
        callback: async (envelope) => {
          received.push(envelope);
        },
        consumerTag: "test-consumer",
      });

      const msg = publisher.create({ body: "hello" } as any);
      await publisher.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].topic).toBe("TckPubBasic");
    });
  });

  describe("publish array", () => {
    it("should dispatch all messages in order", async () => {
      const { publisher, store } = createPublisher(TckPubBasic);

      const received: Array<any> = [];
      store.subscriptions.push({
        topic: "TckPubBasic",
        queue: null,
        callback: async (envelope) => {
          received.push(envelope);
        },
        consumerTag: "test-sub",
      });

      const msg1 = publisher.create({ body: "first" } as any);
      const msg2 = publisher.create({ body: "second" } as any);
      const msg3 = publisher.create({ body: "third" } as any);

      await publisher.publish([msg1, msg2, msg3]);

      expect(received).toHaveLength(3);
    });
  });

  describe("publish with no subscribers", () => {
    it("should complete without error", async () => {
      const { publisher } = createPublisher(TckPubBasic);

      const msg = publisher.create({ body: "nobody listening" } as any);
      await expect(publisher.publish(msg)).resolves.toBeUndefined();
    });
  });

  describe("publish with delay", () => {
    it("should schedule via delayManager instead of immediate dispatch", async () => {
      const delayManager = createMockDelayManager();
      const { publisher, store } = createPublisher(TckPubBasic, { delayManager });

      const received: Array<any> = [];
      store.subscriptions.push({
        topic: "TckPubBasic",
        queue: null,
        callback: async (envelope) => {
          received.push(envelope);
        },
        consumerTag: "test-sub",
      });

      const msg = publisher.create({ body: "delayed" } as any);
      await publisher.publish(msg, { delay: 5000 });

      expect(received).toHaveLength(0);
      expect(delayManager.schedule).toHaveBeenCalledTimes(1);
      expect(delayManager.scheduledCalls[0].delayMs).toBe(5000);
    });

    it("should dispatch immediately when delay > 0 but no delayManager", async () => {
      const { publisher, store } = createPublisher(TckPubBasic);

      const received: Array<any> = [];
      store.subscriptions.push({
        topic: "TckPubBasic",
        queue: null,
        callback: async (envelope) => {
          received.push(envelope);
        },
        consumerTag: "test-sub",
      });

      const msg = publisher.create({ body: "delayed" } as any);
      await publisher.publish(msg, { delay: 5000 });

      expect(received).toHaveLength(1);
    });
  });

  describe("topic resolution", () => {
    it("should use @Topic callback when present", async () => {
      const { publisher, store } = createPublisher(TckPubTopicMsg);

      const received: Array<any> = [];
      store.subscriptions.push({
        topic: "events.orders",
        queue: null,
        callback: async (envelope) => {
          received.push(envelope);
        },
        consumerTag: "test-sub",
      });

      const msg = publisher.create({ category: "orders", data: "payload" } as any);
      await publisher.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].topic).toBe("events.orders");
    });

    it("should fall back to message name when no @Topic", async () => {
      const { publisher, store } = createPublisher(TckPubBasic);

      const received: Array<any> = [];
      store.subscriptions.push({
        topic: "TckPubBasic",
        queue: null,
        callback: async (envelope) => {
          received.push(envelope);
        },
        consumerTag: "test-sub",
      });

      const msg = publisher.create({ body: "test" } as any);
      await publisher.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].topic).toBe("TckPubBasic");
    });
  });

  describe("dispatches to both subs and consumers", () => {
    it("should dispatch to both subscribers and consumers for same topic", async () => {
      const { publisher, store } = createPublisher(TckPubBasic);

      const subReceived: Array<any> = [];
      const consumerReceived: Array<any> = [];

      store.subscriptions.push({
        topic: "TckPubBasic",
        queue: null,
        callback: async (envelope) => {
          subReceived.push(envelope);
        },
        consumerTag: "test-sub",
      });

      store.consumers.push({
        topic: "TckPubBasic",
        callback: async (envelope) => {
          consumerReceived.push(envelope);
        },
        consumerTag: "test-consumer",
      });

      const msg = publisher.create({ body: "both" } as any);
      await publisher.publish(msg);

      expect(subReceived).toHaveLength(1);
      expect(consumerReceived).toHaveLength(1);
    });
  });
});
