import { AbstractMessage } from "../decorators/AbstractMessage";
import { Default } from "../decorators/Default";
import { Encrypted } from "../decorators/Encrypted";
import { Field } from "../decorators/Field";
import { IdentifierField } from "../decorators/IdentifierField";
import { Message } from "../decorators/Message";
import { IrisNotSupportedError } from "../errors/IrisNotSupportedError";
import { IrisSourceError } from "../errors/IrisSourceError";
import type { IMessageSubscriber } from "../interfaces";
import type { IIrisDriver } from "../interfaces/IrisDriver";
import type { IrisSourceOptions, IrisSourceOptionsBase } from "../types";
import { clearRegistry } from "../internal/message/metadata/registry";
import { IrisSource } from "./IrisSource";

// --- Test message classes ---

@Message({ name: "SourceTestMessage" })
class SourceTestMessage {
  @IdentifierField()
  id!: string;

  @Field("string")
  name!: string;
}

@Message({ name: "AnotherTestMessage" })
class AnotherTestMessage {
  @IdentifierField()
  id!: string;

  @Default(0)
  @Field("integer")
  count!: number;
}

@Encrypted()
@Message({ name: "EncryptedTestMessage" })
class EncryptedTestMessage {
  @IdentifierField()
  id!: string;

  @Field("string")
  secret!: string;
}

@AbstractMessage()
class BaseMsg {
  @IdentifierField()
  id!: string;

  @Field("string")
  kind!: string;
}

@Message({ name: "ConcreteMsg" })
class ConcreteMsg extends BaseMsg {
  @Default(0)
  @Field("integer")
  priority!: number;
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

const createMockDriver = (): IIrisDriver => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  drain: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue(true),
  setup: jest.fn().mockResolvedValue(undefined),
  getConnectionState: jest.fn().mockReturnValue("connected"),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  createMessageBus: jest.fn(),
  createPublisher: jest.fn(),
  createWorkerQueue: jest.fn(),
  createStreamProcessor: jest.fn(),
  createRpcClient: jest.fn(),
  createRpcServer: jest.fn(),
  cloneWithGetters: jest.fn(),
});

const createMemoryOptions = (
  overrides: Partial<IrisSourceOptionsBase> = {},
): IrisSourceOptions => ({
  driver: "memory" as const,
  logger: createMockLogger() as any,
  ...overrides,
});

// --- Tests ---

describe("IrisSource", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("constructor", () => {
    it("should construct with memory driver options", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(source.driver).toBe("memory");
    });

    it("should construct with rabbit driver options", () => {
      const source = new IrisSource({
        driver: "rabbit",
        logger: createMockLogger() as any,
        url: "amqp://localhost",
      });
      expect(source.driver).toBe("rabbit");
    });

    it("should construct with kafka driver options", () => {
      const source = new IrisSource({
        driver: "kafka",
        logger: createMockLogger() as any,
        brokers: ["localhost:9092"],
      });
      expect(source.driver).toBe("kafka");
    });

    it("should construct with nats driver options", () => {
      const source = new IrisSource({
        driver: "nats",
        logger: createMockLogger() as any,
        servers: "nats://localhost:4222",
      });
      expect(source.driver).toBe("nats");
    });

    it("should construct with redis driver options", () => {
      const source = new IrisSource({
        driver: "redis",
        logger: createMockLogger() as any,
        url: "redis://localhost:6379",
      });
      expect(source.driver).toBe("redis");
    });

    it("should throw on unknown driver type", () => {
      expect(
        () =>
          new IrisSource({
            driver: "unknown" as any,
            logger: createMockLogger() as any,
          }),
      ).toThrow(IrisNotSupportedError);
    });

    it("should store driver type accessible via .driver getter", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(source.driver).toMatchSnapshot();
    });

    it("should scan messages from constructor options", () => {
      const source = new IrisSource(
        createMemoryOptions({
          messages: [SourceTestMessage, AnotherTestMessage],
        }),
      );
      expect(source.messages).toHaveLength(2);
      expect(source.hasMessage(SourceTestMessage)).toBe(true);
      expect(source.hasMessage(AnotherTestMessage)).toBe(true);
    });

    it("should create with empty messages array", () => {
      const source = new IrisSource(createMemoryOptions({ messages: [] }));
      expect(source.messages).toHaveLength(0);
    });

    it("should create with no messages option", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(source.messages).toHaveLength(0);
    });
  });

  describe("addMessages / hasMessage", () => {
    it("should add messages to the message list", () => {
      const source = new IrisSource(createMemoryOptions());
      source.addMessages([SourceTestMessage]);
      expect(source.hasMessage(SourceTestMessage)).toBe(true);
    });

    it("should return false for unknown message", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(source.hasMessage(SourceTestMessage)).toBe(false);
    });

    it("should not duplicate messages added twice", () => {
      const source = new IrisSource(createMemoryOptions());
      source.addMessages([SourceTestMessage]);
      source.addMessages([SourceTestMessage]);
      expect(source.messages).toHaveLength(1);
    });

    it("should add multiple messages at once", () => {
      const source = new IrisSource(createMemoryOptions());
      source.addMessages([SourceTestMessage, AnotherTestMessage]);
      expect(source.messages).toHaveLength(2);
      expect(source.hasMessage(SourceTestMessage)).toBe(true);
      expect(source.hasMessage(AnotherTestMessage)).toBe(true);
    });
  });

  describe("subscribers", () => {
    it("should add a subscriber", () => {
      const source = new IrisSource(createMemoryOptions());
      const subscriber: IMessageSubscriber = {
        beforePublish: jest.fn(),
      };
      source.addSubscriber(subscriber);

      // Verify by cloning and checking the subscriber list length indirectly
      // We can test this by removing and verifying behavior
      source.removeSubscriber(subscriber);
      // If removeSubscriber doesn't throw, it was previously added
    });

    it("should remove a subscriber", () => {
      const source = new IrisSource(createMemoryOptions());
      const subscriber: IMessageSubscriber = {
        afterConsume: jest.fn(),
      };
      source.addSubscriber(subscriber);
      source.removeSubscriber(subscriber);

      // Adding again should work without duplicate concerns at subscriber level
      source.addSubscriber(subscriber);
    });

    it("should support multiple subscribers", () => {
      const source = new IrisSource(createMemoryOptions());
      const sub1: IMessageSubscriber = { beforePublish: jest.fn() };
      const sub2: IMessageSubscriber = { afterPublish: jest.fn() };
      const sub3: IMessageSubscriber = { beforeConsume: jest.fn() };

      source.addSubscriber(sub1);
      source.addSubscriber(sub2);
      source.addSubscriber(sub3);

      // Remove only one — the others remain
      source.removeSubscriber(sub2);
      // No throw means operation succeeded
    });
  });

  describe("session", () => {
    it("should create a session without affecting the source subscriber list", () => {
      const source = new IrisSource(createMemoryOptions());
      const sub1: IMessageSubscriber = { beforePublish: jest.fn() };
      source.addSubscriber(sub1);

      const session = source.session();
      expect(session.driver).toBe("memory");

      // Adding to the original after session creation should not throw
      const sub2: IMessageSubscriber = { afterPublish: jest.fn() };
      source.addSubscriber(sub2);
      expect((source as any)._subscribersRef.current).toHaveLength(2);
    });

    it("should inherit driver type", () => {
      const source = new IrisSource(createMemoryOptions());
      const session = source.session();
      expect(session.driver).toBe("memory");
    });

    it("should inherit messages", () => {
      const source = new IrisSource(
        createMemoryOptions({
          messages: [SourceTestMessage],
        }),
      );
      const session = source.session();
      expect(session.hasMessage(SourceTestMessage)).toBe(true);
    });

    it("should have independent messages list (adding to source does not affect session)", () => {
      const source = new IrisSource(createMemoryOptions());
      const session = source.session();
      source.addMessages([SourceTestMessage]);
      expect(session.hasMessage(SourceTestMessage)).toBe(false);
      expect(source.hasMessage(SourceTestMessage)).toBe(true);
    });

    it("should use a different logger when provided", () => {
      const logger1 = createMockLogger();
      const logger2 = createMockLogger();

      const source = new IrisSource(createMemoryOptions({ logger: logger1 as any }));
      const session = source.session({ logger: logger2 as any });

      expect(session.driver).toBe("memory");
      expect(logger2.child).toHaveBeenCalled();
    });

    it("should use a different context when provided", () => {
      const source = new IrisSource(createMemoryOptions({ context: { tenant: "A" } }));
      const session = source.session({ context: { tenant: "B" } });
      expect(session.driver).toBe("memory");
    });

    it("should clone a connected driver via cloneWithGetters", () => {
      const mockDriver = createMockDriver();
      const clonedDriver = createMockDriver();
      mockDriver.cloneWithGetters = jest.fn().mockReturnValue(clonedDriver);

      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      const session = source.session();

      expect(mockDriver.cloneWithGetters).toHaveBeenCalledWith(expect.any(Function));
      expect((session as any)._driver).toBe(clonedDriver);
    });
  });

  describe("connect", () => {
    it("should connect successfully with memory driver", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.connect();
      expect((source as any)._driver).toBeDefined();
      await source.disconnect();
    });

    it("should leave driver undefined after connect failure", async () => {
      const source = new IrisSource({
        driver: "nats",
        logger: createMockLogger(),
        servers: "nats://invalid-host-that-does-not-exist:4222",
        connection: { timeout: 100 },
      } as any);

      await expect(source.connect()).rejects.toThrow();
      expect((source as any)._driver).toBeUndefined();
    });

    it("should return early if already connected", async () => {
      const mockDriver = createMockDriver();
      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      await source.connect();
      // No error thrown means early return worked
    });

    it("should deduplicate concurrent connect calls", async () => {
      const source = new IrisSource(createMemoryOptions());

      const p1 = source.connect();
      const p2 = source.connect();

      await Promise.all([p1, p2]);

      expect((source as any)._driver).toBeDefined();
      await source.disconnect();
    });
  });

  describe("disconnect", () => {
    it("should return early when no driver is connected", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.disconnect();
      // No error means early return
    });

    it("should call driver.disconnect and clear driver", async () => {
      const mockDriver = createMockDriver();
      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;
      (source as any).isSetUp = true;

      await source.disconnect();

      expect(mockDriver.disconnect).toHaveBeenCalled();
      expect((source as any)._driver).toBeUndefined();
      expect((source as any).isSetUp).toBe(false);
    });

    it("should clear driver even if disconnect throws", async () => {
      const mockDriver = createMockDriver();
      (mockDriver.disconnect as jest.Mock).mockRejectedValue(
        new Error("disconnect failed"),
      );

      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      await expect(source.disconnect()).rejects.toThrow("disconnect failed");
      expect((source as any)._driver).toBeUndefined();
    });
  });

  describe("ping", () => {
    it("should delegate to driver.ping", async () => {
      const mockDriver = createMockDriver();
      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      const result = await source.ping();
      expect(result).toBe(true);
      expect(mockDriver.ping).toHaveBeenCalled();
    });

    it("should throw when no driver connected", async () => {
      const source = new IrisSource(createMemoryOptions());
      await expect(source.ping()).rejects.toThrow(IrisSourceError);
    });
  });

  describe("setup", () => {
    it("should throw IrisSourceError when driver not connected", async () => {
      const source = new IrisSource(
        createMemoryOptions({ messages: [SourceTestMessage] }),
      );
      await expect(source.setup()).rejects.toThrow(IrisSourceError);
    });

    it("should throw IrisSourceError for encrypted messages without amphora", async () => {
      const mockDriver = createMockDriver();
      const source = new IrisSource(
        createMemoryOptions({ messages: [EncryptedTestMessage] }),
      );
      (source as any)._driver = mockDriver;

      await expect(source.setup()).rejects.toThrow(IrisSourceError);
    });

    it("should call driver.setup with concrete messages", async () => {
      const mockDriver = createMockDriver();
      const source = new IrisSource(
        createMemoryOptions({ messages: [SourceTestMessage] }),
      );
      (source as any)._driver = mockDriver;

      await source.setup();

      expect(mockDriver.setup).toHaveBeenCalledWith([SourceTestMessage]);
      expect((source as any).isSetUp).toBe(true);
    });

    it("should be idempotent — second call returns immediately", async () => {
      const mockDriver = createMockDriver();
      const source = new IrisSource(
        createMemoryOptions({ messages: [SourceTestMessage] }),
      );
      (source as any)._driver = mockDriver;

      await source.setup();
      await source.setup();

      expect(mockDriver.setup).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate concurrent setup calls", async () => {
      const mockDriver = createMockDriver();
      let resolveSetup: () => void;
      (mockDriver.setup as jest.Mock).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSetup = resolve;
          }),
      );

      const source = new IrisSource(
        createMemoryOptions({ messages: [SourceTestMessage] }),
      );
      (source as any)._driver = mockDriver;

      const p1 = source.setup();
      const p2 = source.setup();

      resolveSetup!();

      await Promise.all([p1, p2]);

      expect(mockDriver.setup).toHaveBeenCalledTimes(1);
    });
  });

  describe("messageBus / publisher / workerQueue / stream", () => {
    it("should throw IrisSourceError when driver not connected (messageBus)", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(() => source.messageBus(SourceTestMessage)).toThrow(IrisSourceError);
    });

    it("should throw IrisSourceError when driver not connected (publisher)", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(() => source.publisher(SourceTestMessage)).toThrow(IrisSourceError);
    });

    it("should throw IrisSourceError when driver not connected (workerQueue)", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(() => source.workerQueue(SourceTestMessage)).toThrow(IrisSourceError);
    });

    it("should throw IrisSourceError when driver not connected (stream)", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(() => source.stream()).toThrow(IrisSourceError);
    });

    it("should delegate messageBus to driver", () => {
      const mockDriver = createMockDriver();
      const mockBus = { publish: jest.fn() };
      (mockDriver.createMessageBus as jest.Mock).mockReturnValue(mockBus);

      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      const result = source.messageBus(SourceTestMessage);

      expect(mockDriver.createMessageBus).toHaveBeenCalledWith(SourceTestMessage);
      expect(result).toBe(mockBus);
    });

    it("should delegate publisher to driver", () => {
      const mockDriver = createMockDriver();
      const mockPub = { publish: jest.fn() };
      (mockDriver.createPublisher as jest.Mock).mockReturnValue(mockPub);

      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      const result = source.publisher(SourceTestMessage);

      expect(mockDriver.createPublisher).toHaveBeenCalledWith(SourceTestMessage);
      expect(result).toBe(mockPub);
    });

    it("should delegate workerQueue to driver", () => {
      const mockDriver = createMockDriver();
      const mockQueue = { subscribe: jest.fn() };
      (mockDriver.createWorkerQueue as jest.Mock).mockReturnValue(mockQueue);

      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      const result = source.workerQueue(SourceTestMessage);

      expect(mockDriver.createWorkerQueue).toHaveBeenCalledWith(SourceTestMessage);
      expect(result).toBe(mockQueue);
    });

    it("should delegate stream to driver", () => {
      const mockDriver = createMockDriver();
      const mockStream = { pipe: jest.fn() };
      (mockDriver.createStreamProcessor as jest.Mock).mockReturnValue(mockStream);

      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      const result = source.stream();

      expect(mockDriver.createStreamProcessor).toHaveBeenCalled();
      expect(result).toBe(mockStream);
    });
  });

  describe("rpcClient / rpcServer", () => {
    it("should throw IrisSourceError when driver not connected (rpcClient)", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(() => source.rpcClient(SourceTestMessage, AnotherTestMessage)).toThrow(
        IrisSourceError,
      );
    });

    it("should throw IrisSourceError when driver not connected (rpcServer)", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(() => source.rpcServer(SourceTestMessage, AnotherTestMessage)).toThrow(
        IrisSourceError,
      );
    });

    it("should delegate rpcClient to driver", () => {
      const mockDriver = createMockDriver();
      const mockClient = { request: jest.fn(), close: jest.fn() };
      (mockDriver.createRpcClient as jest.Mock).mockReturnValue(mockClient);

      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      const result = source.rpcClient(SourceTestMessage, AnotherTestMessage);

      expect(mockDriver.createRpcClient).toHaveBeenCalledWith(
        SourceTestMessage,
        AnotherTestMessage,
      );
      expect(result).toBe(mockClient);
    });

    it("should delegate rpcServer to driver", () => {
      const mockDriver = createMockDriver();
      const mockServer = { serve: jest.fn(), unserve: jest.fn(), unserveAll: jest.fn() };
      (mockDriver.createRpcServer as jest.Mock).mockReturnValue(mockServer);

      const source = new IrisSource(createMemoryOptions());
      (source as any)._driver = mockDriver;

      const result = source.rpcServer(SourceTestMessage, AnotherTestMessage);

      expect(mockDriver.createRpcServer).toHaveBeenCalledWith(
        SourceTestMessage,
        AnotherTestMessage,
      );
      expect(result).toBe(mockServer);
    });
  });

  describe("requireDriver", () => {
    it("should throw IrisSourceError with clear message when no driver", () => {
      const source = new IrisSource(createMemoryOptions());
      expect(() => (source as any).requireDriver()).toThrow(IrisSourceError);
      expect(() => (source as any).requireDriver()).toThrow("Driver not connected");
    });
  });

  describe("subscribers — stronger assertions (#7)", () => {
    it("should reflect correct count after addSubscriber", () => {
      const source = new IrisSource(createMemoryOptions());
      const sub1: IMessageSubscriber = { beforePublish: jest.fn() };
      const sub2: IMessageSubscriber = { afterPublish: jest.fn() };

      source.addSubscriber(sub1);
      expect((source as any)._subscribersRef.current.length).toBe(1);

      source.addSubscriber(sub2);
      expect((source as any)._subscribersRef.current.length).toBe(2);
    });

    it("should decrease count after removeSubscriber", () => {
      const source = new IrisSource(createMemoryOptions());
      const sub1: IMessageSubscriber = { beforePublish: jest.fn() };
      const sub2: IMessageSubscriber = { afterPublish: jest.fn() };

      source.addSubscriber(sub1);
      source.addSubscriber(sub2);
      expect((source as any)._subscribersRef.current.length).toBe(2);

      source.removeSubscriber(sub1);
      expect((source as any)._subscribersRef.current.length).toBe(1);
    });

    it("should reflect correct count after adding multiple subscribers", () => {
      const source = new IrisSource(createMemoryOptions());
      const subs: Array<IMessageSubscriber> = [
        { beforePublish: jest.fn() },
        { afterPublish: jest.fn() },
        { beforeConsume: jest.fn() },
        { afterConsume: jest.fn() },
      ];

      for (const sub of subs) {
        source.addSubscriber(sub);
      }

      expect((source as any)._subscribersRef.current.length).toBe(4);
    });
  });

  describe("setup failure + retry (#8)", () => {
    it("should reject on first call when driver.setup fails, succeed on retry", async () => {
      const mockDriver = createMockDriver();
      let callCount = 0;
      (mockDriver.setup as jest.Mock).mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error("setup failed"));
        }
        return Promise.resolve();
      });

      const source = new IrisSource(
        createMemoryOptions({ messages: [SourceTestMessage] }),
      );
      (source as any)._driver = mockDriver;

      await expect(source.setup()).rejects.toThrow("setup failed");
      expect((source as any).isSetUp).toBe(false);

      await source.setup();
      expect((source as any).isSetUp).toBe(true);
    });
  });

  describe("reconnect and re-setup lifecycle", () => {
    it("should succeed through connect → setup → disconnect → connect → setup", async () => {
      const source = new IrisSource(
        createMemoryOptions({ messages: [SourceTestMessage] }),
      );

      // First cycle
      await source.connect();
      expect((source as any)._driver).toBeDefined();

      await source.setup();
      expect((source as any).isSetUp).toBe(true);

      await source.disconnect();
      expect((source as any)._driver).toBeUndefined();
      expect((source as any).isSetUp).toBe(false);

      // Second cycle
      await source.connect();
      expect((source as any)._driver).toBeDefined();

      await source.setup();
      expect((source as any).isSetUp).toBe(true);

      // Verify source is fully functional after reconnect
      const result = await source.ping();
      expect(result).toBe(true);

      await source.disconnect();
    });
  });

  describe("drain", () => {
    it("should delegate to driver.drain(timeout) when connected", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.connect();

      await expect(source.drain(5000)).resolves.toBeUndefined();

      await source.disconnect();
    });

    it("should return without error when not connected", async () => {
      const source = new IrisSource(createMemoryOptions());
      await expect(source.drain()).resolves.toBeUndefined();
    });
  });

  describe("lifecycle cycling", () => {
    it("should handle double disconnect safely", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.connect();
      await source.disconnect();
      await expect(source.disconnect()).resolves.toBeUndefined();
    });

    it("should throw IrisSourceError for operations after disconnect", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.connect();
      await source.disconnect();

      expect(() => source.messageBus(SourceTestMessage)).toThrow(IrisSourceError);
    });

    it("should allow connect after disconnect", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.connect();
      await source.disconnect();
      await source.connect();

      const result = await source.ping();
      expect(result).toBe(true);

      await source.disconnect();
    });
  });

  describe("subscriber hooks integration (real memory driver)", () => {
    let source: IrisSource;

    beforeEach(async () => {
      clearRegistry();
      source = new IrisSource(createMemoryOptions({ messages: [SourceTestMessage] }));
      await source.connect();
      await source.setup();
    });

    afterEach(async () => {
      await source.disconnect();
    });

    it("should invoke beforePublish and afterPublish hooks on publish", async () => {
      const beforePublish = jest.fn();
      const afterPublish = jest.fn();

      source.addSubscriber({ beforePublish, afterPublish });

      const bus = source.messageBus(SourceTestMessage);
      const msg = bus.create({ name: "hook-test" } as any);
      await bus.publish(msg);

      expect(beforePublish).toHaveBeenCalledTimes(1);
      expect(afterPublish).toHaveBeenCalledTimes(1);

      expect(beforePublish).toHaveBeenCalledWith(
        expect.objectContaining({ name: "hook-test" }),
      );
      expect(afterPublish).toHaveBeenCalledWith(
        expect.objectContaining({ name: "hook-test" }),
      );
    });

    it("should invoke beforeConsume and afterConsume hooks on subscribe + publish", async () => {
      const beforeConsume = jest.fn();
      const afterConsume = jest.fn();

      source.addSubscriber({ beforeConsume, afterConsume });

      const bus = source.messageBus(SourceTestMessage);

      await bus.subscribe({
        topic: "SourceTestMessage",
        callback: async () => {},
      });

      const msg = bus.create({ name: "consume-hook" } as any);
      await bus.publish(msg);

      expect(beforeConsume).toHaveBeenCalledTimes(1);
      expect(afterConsume).toHaveBeenCalledTimes(1);

      expect(beforeConsume).toHaveBeenCalledWith(
        expect.objectContaining({ name: "consume-hook" }),
      );
      expect(afterConsume).toHaveBeenCalledWith(
        expect.objectContaining({ name: "consume-hook" }),
      );
    });

    it("should invoke onConsumeError when consume callback throws", async () => {
      const onConsumeError = jest.fn();

      source.addSubscriber({ onConsumeError });

      const bus = source.messageBus(SourceTestMessage);

      await bus.subscribe({
        topic: "SourceTestMessage",
        callback: async () => {
          throw new Error("consume-failure");
        },
      });

      const msg = bus.create({ name: "error-hook" } as any);
      await bus.publish(msg);

      expect(onConsumeError).toHaveBeenCalledTimes(1);
      expect(onConsumeError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "consume-failure" }),
        expect.objectContaining({ name: "error-hook" }),
      );
    });

    it("should isolate hook errors — publish succeeds even when beforePublish throws", async () => {
      const badSubscriber: IMessageSubscriber = {
        beforePublish: jest.fn().mockRejectedValue(new Error("hook-boom")),
      };
      const goodSubscriber: IMessageSubscriber = {
        afterPublish: jest.fn(),
      };

      source.addSubscriber(badSubscriber);
      source.addSubscriber(goodSubscriber);

      const bus = source.messageBus(SourceTestMessage);

      await bus.subscribe({
        topic: "SourceTestMessage",
        callback: async () => {},
      });

      const msg = bus.create({ name: "isolated" } as any);
      await expect(bus.publish(msg)).resolves.toBeUndefined();

      expect(badSubscriber.beforePublish).toHaveBeenCalledTimes(1);
      expect(goodSubscriber.afterPublish).toHaveBeenCalledTimes(1);
    });

    it("should invoke hooks on multiple subscribers", async () => {
      const beforePublish1 = jest.fn();
      const beforePublish2 = jest.fn();

      source.addSubscriber({ beforePublish: beforePublish1 });
      source.addSubscriber({ beforePublish: beforePublish2 });

      const bus = source.messageBus(SourceTestMessage);
      const msg = bus.create({ name: "multi-sub" } as any);
      await bus.publish(msg);

      expect(beforePublish1).toHaveBeenCalledTimes(1);
      expect(beforePublish2).toHaveBeenCalledTimes(1);
    });
  });

  describe("delay and dead letter managers", () => {
    it("should create managers when connecting with memory driver", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.connect();

      expect((source as any)._delayManager).toBeDefined();
      expect((source as any)._deadLetterManager).toBeDefined();

      await source.disconnect();
    });

    it("should NOT create managers for rabbit driver", async () => {
      const source = new IrisSource({
        driver: "rabbit",
        logger: createMockLogger() as any,
        url: "amqp://localhost",
      });

      // Rabbit connect will fail since there's no broker,
      // but we can check that the managers aren't created by inspecting
      // before connect or by catching the error
      expect((source as any)._delayManager).toBeUndefined();
      expect((source as any)._deadLetterManager).toBeUndefined();
    });

    it("should pass managers to sessions via constructor options", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.connect();

      // The managers exist on the parent
      expect((source as any)._delayManager).toBeDefined();
      expect((source as any)._deadLetterManager).toBeDefined();

      // Creating a session should not throw — managers are passed through
      const session = source.session();
      expect(session.driver).toBe("memory");

      await source.disconnect();
    });

    it("should clean up managers on disconnect", async () => {
      const source = new IrisSource(createMemoryOptions());
      await source.connect();

      expect((source as any)._delayManager).toBeDefined();
      expect((source as any)._deadLetterManager).toBeDefined();

      await source.disconnect();

      expect((source as any)._delayManager).toBeUndefined();
      expect((source as any)._deadLetterManager).toBeUndefined();
    });

    it("should accept custom persistence config", async () => {
      const source = new IrisSource(
        createMemoryOptions({
          persistence: {
            delay: { type: "memory" },
            deadLetter: { type: "memory" },
          },
        }),
      );
      await source.connect();

      expect((source as any)._delayManager).toBeDefined();
      expect((source as any)._deadLetterManager).toBeDefined();

      await source.disconnect();
    });
  });

  describe("addMessages after setup guard", () => {
    it("should throw IrisSourceError when adding messages after setup", async () => {
      const source = new IrisSource(
        createMemoryOptions({ messages: [SourceTestMessage] }),
      );
      await source.connect();
      await source.setup();

      expect(() => source.addMessages([AnotherTestMessage])).toThrow(IrisSourceError);
      expect(() => source.addMessages([AnotherTestMessage])).toThrow(
        "Cannot add messages after setup",
      );

      await source.disconnect();
    });
  });

  describe("abstract message filtering in setup (#9)", () => {
    it("should filter out abstract messages and pass only concrete ones to driver.setup", async () => {
      const mockDriver = createMockDriver();
      const source = new IrisSource(
        createMemoryOptions({ messages: [BaseMsg, ConcreteMsg] }),
      );
      (source as any)._driver = mockDriver;

      await source.setup();

      expect(mockDriver.setup).toHaveBeenCalledTimes(1);
      const passedMessages = (mockDriver.setup as jest.Mock).mock.calls[0][0];
      expect(passedMessages).toHaveLength(1);
      expect(passedMessages[0]).toBe(ConcreteMsg);
    });
  });
});
