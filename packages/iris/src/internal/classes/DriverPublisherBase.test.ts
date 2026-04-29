import type { Constructor } from "@lindorm/types";
import { Default } from "../../decorators/Default.js";
import { Field } from "../../decorators/Field.js";
import { IdentifierField } from "../../decorators/IdentifierField.js";
import { Message } from "../../decorators/Message.js";
import { BeforePublish } from "../../decorators/BeforePublish.js";
import { AfterPublish } from "../../decorators/AfterPublish.js";
import type { IMessage, IMessageSubscriber } from "../../interfaces/index.js";
import type { PublishOptions } from "../../types/index.js";
import { clearRegistry } from "../message/metadata/registry.js";
import {
  DriverPublisherBase,
  type DriverPublisherBaseOptions,
} from "./DriverPublisherBase.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

const beforePublishSpy = vi.fn();
const afterPublishSpy = vi.fn();

@AfterPublish((msg) => {
  afterPublishSpy(msg);
})
@BeforePublish((msg) => {
  beforePublishSpy(msg);
})
@Message({ name: "PubTestMessage" })
class PubTestMessage {
  @IdentifierField()
  id!: string;

  @Field("string")
  label!: string;

  @Default(0)
  @Field("integer")
  seq!: number;
}

@Message({ name: "SimplePubMessage" })
class SimplePubMessage {
  @IdentifierField()
  id!: string;

  @Default("default-val")
  @Field("string")
  value!: string;
}

// --- Concrete test subclass ---

class TestPublisher<M extends IMessage> extends DriverPublisherBase<M> {
  public constructor(options: DriverPublisherBaseOptions<M>) {
    super(options);
  }

  public async publish(
    _message: M | Array<M>,
    _options?: PublishOptions,
  ): Promise<void> {}

  public testPrepareForPublish(message: M) {
    return this.prepareForPublish(message);
  }

  public testCompletePublish(message: M) {
    return this.completePublish(message);
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

const createPublisher = <M extends IMessage>(
  target: Constructor<M>,
  subscribers: Array<IMessageSubscriber> = [],
): TestPublisher<M> =>
  new TestPublisher<M>({
    target,
    logger: createMockLogger() as any,
    getSubscribers: () => subscribers,
  });

// --- Tests ---

describe("DriverPublisherBase", () => {
  beforeEach(() => {
    clearRegistry();
    beforePublishSpy.mockClear();
    afterPublishSpy.mockClear();
  });

  describe("create", () => {
    it("should create a message with defaults", () => {
      const pub = createPublisher<SimplePubMessage>(SimplePubMessage);
      const msg = pub.create();

      expect(msg.id).toEqual(expect.any(String));
      expect(msg.value).toBe("default-val");
    });

    it("should create a message with provided values", () => {
      const pub = createPublisher<PubTestMessage>(PubTestMessage);
      const msg = pub.create({ label: "test", seq: 42 } as any);

      expect(msg.label).toBe("test");
      expect(msg.seq).toBe(42);
    });
  });

  describe("hydrate", () => {
    it("should hydrate a message from raw data", () => {
      const pub = createPublisher<PubTestMessage>(PubTestMessage);
      const msg = pub.hydrate({
        id: "hydrate-id-123",
        label: "hydrated",
        seq: 99,
      });

      expect(msg.id).toBe("hydrate-id-123");
      expect(msg.label).toBe("hydrated");
      expect(msg.seq).toBe(99);
    });
  });

  describe("validate", () => {
    it("should not throw for a valid message", () => {
      const pub = createPublisher(PubTestMessage);
      const msg = pub.create({ label: "valid", seq: 1 } as any);

      expect(() => pub.validate(msg)).not.toThrow();
    });

    it("should throw for an invalid message", () => {
      const pub = createPublisher(PubTestMessage);
      const msg = pub.create({ label: "valid" } as any);
      (msg as any).id = 12345;

      expect(() => pub.validate(msg)).toThrow();
    });
  });

  describe("prepareForPublish", () => {
    it("should run beforePublish hooks and produce payload and headers", async () => {
      const subscriberBefore = vi.fn();
      const subscriber: IMessageSubscriber = {
        beforePublish: subscriberBefore,
      };

      const pub = createPublisher<PubTestMessage>(PubTestMessage, [subscriber]);
      const msg = pub.create({ label: "pub-test", seq: 7 } as any);

      const result = await pub.testPrepareForPublish(msg);

      expect(beforePublishSpy).toHaveBeenCalledWith(msg);
      expect(subscriberBefore).toHaveBeenCalledWith(msg);
      expect(result).toHaveProperty("payload");
      expect(result).toHaveProperty("headers");
      expect(Buffer.isBuffer(result.payload)).toBe(true);
      expect(typeof result.headers).toBe("object");
    });

    it("should not call afterPublish during prepareForPublish", async () => {
      const pub = createPublisher<PubTestMessage>(PubTestMessage);
      const msg = pub.create({ label: "no-after", seq: 0 } as any);

      await pub.testPrepareForPublish(msg);

      expect(afterPublishSpy).not.toHaveBeenCalled();
    });
  });

  describe("completePublish", () => {
    it("should fire afterPublish hooks and subscriber callbacks", async () => {
      const subscriberAfter = vi.fn();
      const subscriber: IMessageSubscriber = {
        afterPublish: subscriberAfter,
      };

      const pub = createPublisher<PubTestMessage>(PubTestMessage, [subscriber]);
      const msg = pub.create({ label: "complete-test", seq: 3 } as any);

      await pub.testCompletePublish(msg);

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

      const pub = createPublisher<PubTestMessage>(PubTestMessage, [sub1, sub2]);
      const msg = pub.create({ label: "order-test", seq: 0 } as any);

      await pub.testCompletePublish(msg);

      expect(callOrder).toMatchSnapshot();
    });
  });
});
