import type { Constructor } from "@lindorm/types";
import { Default } from "../../decorators/Default";
import { Field } from "../../decorators/Field";
import { IdentifierField } from "../../decorators/IdentifierField";
import { Message } from "../../decorators/Message";
import { BeforePublish } from "../../decorators/BeforePublish";
import { AfterPublish } from "../../decorators/AfterPublish";
import { BeforeConsume } from "../../decorators/BeforeConsume";
import { AfterConsume } from "../../decorators/AfterConsume";
import { OnConsumeError } from "../../decorators/OnConsumeError";
import type { IMessage, IMessageSubscriber } from "../../interfaces";
import type { ConsumeEnvelope, ConsumeOptions, PublishOptions } from "../../types";
import { clearRegistry } from "../message/metadata/registry";
import {
  DriverWorkerQueueBase,
  type DriverWorkerQueueBaseOptions,
} from "./DriverWorkerQueueBase";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

const beforePublishSpy = vi.fn();
const afterPublishSpy = vi.fn();
const beforeConsumeSpy = vi.fn();
const afterConsumeSpy = vi.fn();
const onConsumeErrorSpy = vi.fn();

@AfterConsume((msg) => {
  afterConsumeSpy(msg);
})
@BeforeConsume((msg) => {
  beforeConsumeSpy(msg);
})
@AfterPublish((msg) => {
  afterPublishSpy(msg);
})
@BeforePublish((msg) => {
  beforePublishSpy(msg);
})
@OnConsumeError((error, msg) => {
  onConsumeErrorSpy(error, msg);
})
@Message({ name: "WqTestMessage" })
class WqTestMessage {
  @IdentifierField()
  id!: string;

  @Field("string")
  label!: string;

  @Default(0)
  @Field("integer")
  seq!: number;
}

@Message({ name: "SimpleWqMessage" })
class SimpleWqMessage {
  @IdentifierField()
  id!: string;

  @Default("wq-default")
  @Field("string")
  value!: string;
}

// --- Concrete test subclass ---

class TestWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<M> {
  public constructor(options: DriverWorkerQueueBaseOptions<M>) {
    super(options);
  }

  public async publish(
    _message: M | Array<M>,
    _options?: PublishOptions,
  ): Promise<void> {}

  public async consume(
    _queueOrOptions: string | ConsumeOptions<M>,
    _callback?: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<void> {}

  public async unconsume(_queue: string): Promise<void> {}

  public async unconsumeAll(): Promise<void> {}

  public testPrepareForPublish(message: M) {
    return this.prepareForPublish(message);
  }

  public testCompletePublish(message: M) {
    return this.completePublish(message);
  }

  public testPrepareForConsume(
    payload: Buffer | string,
    headers: Record<string, string>,
  ) {
    return this.prepareForConsume(payload, headers);
  }

  public testAfterConsumeSuccess(message: M) {
    return this.afterConsumeSuccess(message);
  }

  public testOnConsumeError(error: Error, message: M) {
    return this.onConsumeError(error, message);
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

const createQueue = <M extends IMessage>(
  target: Constructor<M>,
  subscribers: Array<IMessageSubscriber> = [],
): TestWorkerQueue<M> =>
  new TestWorkerQueue<M>({
    target,
    logger: createMockLogger() as any,
    getSubscribers: () => subscribers,
  });

// --- Tests ---

describe("DriverWorkerQueueBase", () => {
  beforeEach(() => {
    clearRegistry();
    beforePublishSpy.mockClear();
    afterPublishSpy.mockClear();
    beforeConsumeSpy.mockClear();
    afterConsumeSpy.mockClear();
    onConsumeErrorSpy.mockClear();
  });

  describe("create", () => {
    it("should create a message with defaults", () => {
      const queue = createQueue(SimpleWqMessage);
      const msg = queue.create();

      expect(msg.id).toEqual(expect.any(String));
      expect(msg.value).toBe("wq-default");
    });

    it("should create a message with provided values", () => {
      const queue = createQueue(WqTestMessage);
      const msg = queue.create({ label: "test", seq: 10 } as any);

      expect(msg.label).toBe("test");
      expect(msg.seq).toBe(10);
    });
  });

  describe("hydrate", () => {
    it("should hydrate a message from raw data", () => {
      const queue = createQueue(WqTestMessage);
      const msg = queue.hydrate({
        id: "wq-id-456",
        label: "hydrated",
        seq: 55,
      });

      expect(msg.id).toBe("wq-id-456");
      expect(msg.label).toBe("hydrated");
      expect(msg.seq).toBe(55);
    });
  });

  describe("validate", () => {
    it("should not throw for a valid message", () => {
      const queue = createQueue(WqTestMessage);
      const msg = queue.create({ label: "valid", seq: 1 } as any);

      expect(() => queue.validate(msg)).not.toThrow();
    });

    it("should throw for an invalid message", () => {
      const queue = createQueue(WqTestMessage);
      const msg = queue.create({ label: "valid" } as any);
      (msg as any).id = 12345;

      expect(() => queue.validate(msg)).toThrow();
    });
  });

  describe("prepareForPublish", () => {
    it("should run beforePublish hooks and produce payload and headers", async () => {
      const subscriberBefore = vi.fn();
      const subscriber: IMessageSubscriber = {
        beforePublish: subscriberBefore,
      };

      const queue = createQueue<WqTestMessage>(WqTestMessage, [subscriber]);
      const msg = queue.create({ label: "pub-test", seq: 7 } as any);

      const result = await queue.testPrepareForPublish(msg);

      expect(beforePublishSpy).toHaveBeenCalledWith(msg);
      expect(subscriberBefore).toHaveBeenCalledWith(msg);
      expect(result).toHaveProperty("payload");
      expect(result).toHaveProperty("headers");
      expect(Buffer.isBuffer(result.payload)).toBe(true);
    });

    it("should not call afterPublish during prepareForPublish", async () => {
      const queue = createQueue<WqTestMessage>(WqTestMessage);
      const msg = queue.create({ label: "no-after", seq: 0 } as any);

      await queue.testPrepareForPublish(msg);

      expect(afterPublishSpy).not.toHaveBeenCalled();
    });
  });

  describe("completePublish", () => {
    it("should fire afterPublish hooks and subscriber callbacks", async () => {
      const subscriberAfter = vi.fn();
      const subscriber: IMessageSubscriber = {
        afterPublish: subscriberAfter,
      };

      const queue = createQueue<WqTestMessage>(WqTestMessage, [subscriber]);
      const msg = queue.create({ label: "complete-test", seq: 3 } as any);

      await queue.testCompletePublish(msg);

      expect(afterPublishSpy).toHaveBeenCalledWith(msg);
      expect(subscriberAfter).toHaveBeenCalledWith(msg);
    });

    it("should call subscribers in order", async () => {
      const callOrder: Array<string> = [];
      const sub1: IMessageSubscriber = {
        afterPublish: vi.fn(() => {
          callOrder.push("sub1-after");
        }),
      };
      const sub2: IMessageSubscriber = {
        afterPublish: vi.fn(() => {
          callOrder.push("sub2-after");
        }),
      };

      const queue = createQueue<WqTestMessage>(WqTestMessage, [sub1, sub2]);
      const msg = queue.create({ label: "order-test", seq: 0 } as any);

      await queue.testCompletePublish(msg);

      expect(callOrder).toMatchSnapshot();
    });
  });

  describe("prepareForConsume", () => {
    it("should hydrate from payload/headers and run hooks and subscriber callbacks", async () => {
      const subscriberBefore = vi.fn();
      const subscriber: IMessageSubscriber = {
        beforeConsume: subscriberBefore,
      };

      const queue = createQueue<WqTestMessage>(WqTestMessage, [subscriber]);
      const msg = queue.create({ label: "consume-test", seq: 3 } as any);

      // Prepare outbound to get valid payload/headers
      const outbound = await queue.testPrepareForPublish(msg);

      const consumed = await queue.testPrepareForConsume(
        outbound.payload,
        outbound.headers,
      );

      expect(beforeConsumeSpy).toHaveBeenCalled();
      expect(subscriberBefore).toHaveBeenCalled();
      expect(consumed.label).toBe("consume-test");
      expect(consumed.seq).toBe(3);
    });
  });

  describe("afterConsumeSuccess", () => {
    it("should fire afterConsume hooks and subscriber callbacks", async () => {
      const subscriberAfter = vi.fn();
      const subscriber: IMessageSubscriber = {
        afterConsume: subscriberAfter,
      };

      const queue = createQueue<WqTestMessage>(WqTestMessage, [subscriber]);
      const msg = queue.create({ label: "success-test", seq: 0 } as any);

      await queue.testAfterConsumeSuccess(msg);

      expect(afterConsumeSpy).toHaveBeenCalledWith(msg);
      expect(subscriberAfter).toHaveBeenCalledWith(msg);
    });

    it("should call subscribers in order", async () => {
      const callOrder: Array<string> = [];
      const sub1: IMessageSubscriber = {
        afterConsume: vi.fn(() => {
          callOrder.push("sub1");
        }),
      };
      const sub2: IMessageSubscriber = {
        afterConsume: vi.fn(() => {
          callOrder.push("sub2");
        }),
      };

      const queue = createQueue<WqTestMessage>(WqTestMessage, [sub1, sub2]);
      const msg = queue.create({ label: "order-test", seq: 0 } as any);

      await queue.testAfterConsumeSuccess(msg);

      expect(callOrder).toMatchSnapshot();
    });
  });

  describe("onConsumeError", () => {
    it("should forward error to both hooks and subscribers", async () => {
      const subscriberError = vi.fn();
      const subscriber: IMessageSubscriber = {
        onConsumeError: subscriberError,
      };

      const queue = createQueue<WqTestMessage>(WqTestMessage, [subscriber]);
      const msg = queue.create({ label: "error-test", seq: 0 } as any);
      const error = new Error("test error");

      await queue.testOnConsumeError(error, msg);

      expect(onConsumeErrorSpy).toHaveBeenCalledWith(error, msg);
      expect(subscriberError).toHaveBeenCalledWith(error, msg);
    });

    it("should call subscribers in order", async () => {
      const callOrder: Array<string> = [];
      const sub1: IMessageSubscriber = {
        onConsumeError: vi.fn(() => {
          callOrder.push("sub1");
        }),
      };
      const sub2: IMessageSubscriber = {
        onConsumeError: vi.fn(() => {
          callOrder.push("sub2");
        }),
      };

      const queue = createQueue<WqTestMessage>(WqTestMessage, [sub1, sub2]);
      const msg = queue.create({ label: "order-test", seq: 0 } as any);

      await queue.testOnConsumeError(new Error("fail"), msg);

      expect(callOrder).toMatchSnapshot();
    });
  });

  describe("subscribers without optional methods", () => {
    it("should handle subscribers that have no methods defined", async () => {
      const emptySubscriber: IMessageSubscriber = {};

      const queue = createQueue<SimpleWqMessage>(SimpleWqMessage, [emptySubscriber]);
      const msg = queue.create();

      const outbound = await queue.testPrepareForPublish(msg);
      await queue.testCompletePublish(msg);
      const consumed = await queue.testPrepareForConsume(
        outbound.payload,
        outbound.headers,
      );
      await queue.testAfterConsumeSuccess(consumed);
      await queue.testOnConsumeError(new Error("test"), consumed);
    });
  });
});
