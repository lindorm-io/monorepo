import type { Constructor } from "@lindorm/types";
import { Default } from "../../decorators/Default.js";
import { Field } from "../../decorators/Field.js";
import { IdentifierField } from "../../decorators/IdentifierField.js";
import { Message } from "../../decorators/Message.js";
import { BeforePublish } from "../../decorators/BeforePublish.js";
import { AfterPublish } from "../../decorators/AfterPublish.js";
import { BeforeConsume } from "../../decorators/BeforeConsume.js";
import { AfterConsume } from "../../decorators/AfterConsume.js";
import { OnConsumeError } from "../../decorators/OnConsumeError.js";
import type { IMessage, IMessageSubscriber } from "../../interfaces/index.js";
import type { PublishOptions, SubscribeOptions } from "../../types/index.js";
import { clearRegistry } from "../message/metadata/registry.js";
import {
  DriverMessageBusBase,
  type DriverMessageBusBaseOptions,
} from "./DriverMessageBusBase.js";
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
@Message({ name: "BusTestMessage" })
class BusTestMessage {
  @IdentifierField()
  id!: string;

  @Field("string")
  name!: string;

  @Default(0)
  @Field("integer")
  count!: number;
}

@Message({ name: "SimpleBusMessage" })
class SimpleBusMessage {
  @IdentifierField()
  id!: string;

  @Default("hello")
  @Field("string")
  value!: string;
}

// --- Concrete test subclass ---

class TestMessageBus<M extends IMessage> extends DriverMessageBusBase<M> {
  public constructor(options: DriverMessageBusBaseOptions<M>) {
    super(options);
  }

  public async publish(
    _message: M | Array<M>,
    _options?: PublishOptions,
  ): Promise<void> {}

  public async subscribe(_options: SubscribeOptions<M>): Promise<void> {}

  public async unsubscribe(_options: { topic: string; queue?: string }): Promise<void> {}

  public async unsubscribeAll(): Promise<void> {}

  // Expose protected methods for testing
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

const createBus = <M extends IMessage>(
  target: Constructor<M>,
  subscribers: Array<IMessageSubscriber> = [],
): TestMessageBus<M> =>
  new TestMessageBus<M>({
    target,
    logger: createMockLogger() as any,
    getSubscribers: () => subscribers,
  });

// --- Tests ---

describe("DriverMessageBusBase", () => {
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
      const bus = createBus(SimpleBusMessage);
      const msg = bus.create();

      expect(msg.id).toEqual(expect.any(String));
      expect(msg.value).toBe("hello");
    });

    it("should create a message with provided values", () => {
      const bus = createBus(BusTestMessage);
      const msg = bus.create({ name: "test", count: 42 } as any);

      expect(msg.name).toBe("test");
      expect(msg.count).toBe(42);
    });
  });

  describe("hydrate", () => {
    it("should hydrate a message from raw data", () => {
      const bus = createBus(BusTestMessage);
      const msg = bus.hydrate({
        id: "abc-123",
        name: "hydrated",
        count: 10,
      });

      expect(msg.id).toBe("abc-123");
      expect(msg.name).toBe("hydrated");
      expect(msg.count).toBe(10);
    });
  });

  describe("copy", () => {
    it("should create a copy with new identity fields", () => {
      const bus = createBus(BusTestMessage);
      const original = bus.create({ name: "original", count: 5 } as any);
      const copied = bus.copy(original);

      expect(copied.name).toBe("original");
      expect(copied.count).toBe(5);
      expect(copied.id).not.toBe(original.id);
    });
  });

  describe("validate", () => {
    it("should not throw for a valid message", () => {
      const bus = createBus(BusTestMessage);
      const msg = bus.create({ name: "valid", count: 1 } as any);

      expect(() => bus.validate(msg)).not.toThrow();
    });

    it("should throw for an invalid message", () => {
      const bus = createBus(BusTestMessage);
      const msg = bus.create({ name: "valid" } as any);
      (msg as any).id = 12345; // invalid type — id should be uuid string

      expect(() => bus.validate(msg)).toThrow();
    });
  });

  describe("prepareForPublish", () => {
    it("should run beforePublish hooks and subscriber callbacks and produce payload/headers", async () => {
      const subscriberBefore = vi.fn();
      const subscriber: IMessageSubscriber = {
        beforePublish: subscriberBefore,
      };

      const bus = createBus<BusTestMessage>(BusTestMessage, [subscriber]);
      const msg = bus.create({ name: "publish-test", count: 7 } as any);

      const result = await bus.testPrepareForPublish(msg);

      expect(beforePublishSpy).toHaveBeenCalledWith(msg);
      expect(subscriberBefore).toHaveBeenCalledWith(msg);
      expect(afterPublishSpy).not.toHaveBeenCalled();
      expect(result).toHaveProperty("payload");
      expect(result).toHaveProperty("headers");
      expect(Buffer.isBuffer(result.payload)).toBe(true);
      expect(typeof result.headers).toBe("object");
    });

    it("should call subscribers in order", async () => {
      const callOrder: Array<string> = [];
      const sub1: IMessageSubscriber = {
        beforePublish: vi.fn(() => {
          callOrder.push("sub1-before");
        }),
      };
      const sub2: IMessageSubscriber = {
        beforePublish: vi.fn(() => {
          callOrder.push("sub2-before");
        }),
      };

      const bus = createBus<BusTestMessage>(BusTestMessage, [sub1, sub2]);
      const msg = bus.create({ name: "order-test", count: 0 } as any);

      await bus.testPrepareForPublish(msg);

      expect(callOrder).toMatchSnapshot();
    });
  });

  describe("completePublish", () => {
    it("should run afterPublish hooks and subscriber callbacks", async () => {
      const subscriberAfter = vi.fn();
      const subscriber: IMessageSubscriber = {
        afterPublish: subscriberAfter,
      };

      const bus = createBus<BusTestMessage>(BusTestMessage, [subscriber]);
      const msg = bus.create({ name: "publish-test", count: 7 } as any);

      await bus.testCompletePublish(msg);

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

      const bus = createBus<BusTestMessage>(BusTestMessage, [sub1, sub2]);
      const msg = bus.create({ name: "order-test", count: 0 } as any);

      await bus.testCompletePublish(msg);

      expect(callOrder).toMatchSnapshot();
    });
  });

  describe("prepareForConsume", () => {
    it("should hydrate from payload/headers and run hooks and subscriber callbacks", async () => {
      const subscriberBefore = vi.fn();
      const subscriber: IMessageSubscriber = {
        beforeConsume: subscriberBefore,
      };

      const bus = createBus<BusTestMessage>(BusTestMessage, [subscriber]);
      const msg = bus.create({ name: "consume-test", count: 3 } as any);

      // First prepare outbound to get valid payload/headers
      const outbound = await bus.testPrepareForPublish(msg);

      // Now consume
      const consumed = await bus.testPrepareForConsume(
        outbound.payload,
        outbound.headers,
      );

      expect(beforeConsumeSpy).toHaveBeenCalled();
      expect(subscriberBefore).toHaveBeenCalled();
      expect(consumed.name).toBe("consume-test");
      expect(consumed.count).toBe(3);
    });
  });

  describe("afterConsumeSuccess", () => {
    it("should run hooks and subscriber callbacks", async () => {
      const subscriberAfter = vi.fn();
      const subscriber: IMessageSubscriber = {
        afterConsume: subscriberAfter,
      };

      const bus = createBus<BusTestMessage>(BusTestMessage, [subscriber]);
      const msg = bus.create({ name: "success-test", count: 0 } as any);

      await bus.testAfterConsumeSuccess(msg);

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

      const bus = createBus<BusTestMessage>(BusTestMessage, [sub1, sub2]);
      const msg = bus.create({ name: "order-test", count: 0 } as any);

      await bus.testAfterConsumeSuccess(msg);

      expect(callOrder).toMatchSnapshot();
    });
  });

  describe("onConsumeError", () => {
    it("should run hooks and subscriber callbacks with error", async () => {
      const subscriberError = vi.fn();
      const subscriber: IMessageSubscriber = {
        onConsumeError: subscriberError,
      };

      const bus = createBus<BusTestMessage>(BusTestMessage, [subscriber]);
      const msg = bus.create({ name: "error-test", count: 0 } as any);
      const error = new Error("test error");

      await bus.testOnConsumeError(error, msg);

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

      const bus = createBus<BusTestMessage>(BusTestMessage, [sub1, sub2]);
      const msg = bus.create({ name: "order-test", count: 0 } as any);

      await bus.testOnConsumeError(new Error("fail"), msg);

      expect(callOrder).toMatchSnapshot();
    });
  });

  describe("validation failure in prepareForPublish (#13)", () => {
    it("should throw on invalid message and not call beforePublish hooks", async () => {
      const subscriberBefore = vi.fn();
      const subscriber: IMessageSubscriber = {
        beforePublish: subscriberBefore,
      };

      const bus = createBus<BusTestMessage>(BusTestMessage, [subscriber]);
      const msg = bus.create({ name: "valid" } as any);
      // Corrupt the id to trigger validation failure
      (msg as any).id = 12345;

      await expect(bus.testPrepareForPublish(msg)).rejects.toThrow();
      expect(beforePublishSpy).not.toHaveBeenCalled();
      expect(subscriberBefore).not.toHaveBeenCalled();
    });
  });

  describe("hook vs subscriber ordering (#11)", () => {
    it("should call decorator hooks before subscriber hooks in both prepare and complete", async () => {
      const callOrder: Array<string> = [];

      // Track decorator hooks via the module-level spies
      beforePublishSpy.mockImplementation(() => {
        callOrder.push("decorator-beforePublish");
      });
      afterPublishSpy.mockImplementation(() => {
        callOrder.push("decorator-afterPublish");
      });

      const subscriber: IMessageSubscriber = {
        beforePublish: vi.fn(() => {
          callOrder.push("subscriber-beforePublish");
        }),
        afterPublish: vi.fn(() => {
          callOrder.push("subscriber-afterPublish");
        }),
      };

      const bus = createBus<BusTestMessage>(BusTestMessage, [subscriber]);
      const msg = bus.create({ name: "order-test", count: 1 } as any);

      await bus.testPrepareForPublish(msg);
      await bus.testCompletePublish(msg);

      expect(callOrder).toMatchSnapshot();
    });
  });

  describe("subscribers without optional methods", () => {
    it("should handle subscribers that have no methods defined", async () => {
      const emptySubscriber: IMessageSubscriber = {};

      const bus = createBus<SimpleBusMessage>(SimpleBusMessage, [emptySubscriber]);
      const msg = bus.create();

      await bus.testPrepareForPublish(msg);
      const outbound = await bus.testPrepareForPublish(msg);
      await bus.testCompletePublish(msg);
      const consumed = await bus.testPrepareForConsume(
        outbound.payload,
        outbound.headers,
      );
      await bus.testAfterConsumeSuccess(consumed);
      await bus.testOnConsumeError(new Error("test"), consumed);
      // No throw means all optional callbacks were safely skipped
    });
  });
});
