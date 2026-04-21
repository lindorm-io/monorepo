import type { IMessage } from "../../../../interfaces/index.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { OutboundPayload } from "../../../message/utils/prepare-outbound.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import { publishRabbitMessages, type RabbitPublishDriver } from "./publish-messages.js";
import { describe, expect, it, vi, type Mock } from "vitest";

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMetadata = (overrides: Partial<MessageMetadata> = {}): MessageMetadata =>
  ({
    message: { name: "TestMessage" },
    priority: 0,
    expiry: null,
    delay: null,
    broadcast: false,
    retry: null,
    topic: null,
    persistent: true,
    fields: [],
    namespace: null,
    ...overrides,
  }) as unknown as MessageMetadata;

const createDriver = (
  metadata: MessageMetadata,
): RabbitPublishDriver<IMessage> & {
  calls: { prepared: Array<IMessage>; completed: Array<IMessage> };
} => {
  const calls = { prepared: [] as Array<IMessage>, completed: [] as Array<IMessage> };
  return {
    metadata,
    calls,
    prepareForPublish: vi.fn(async (message: IMessage): Promise<OutboundPayload> => {
      calls.prepared.push(message);
      return { payload: Buffer.from("test-payload"), headers: {} };
    }),
    completePublish: vi.fn(async (message: IMessage): Promise<void> => {
      calls.completed.push(message);
    }),
  };
};

const createMockChannel = () => ({
  publish: vi.fn(
    (
      _exchange: string,
      _routingKey: string,
      _content: Buffer,
      _options: any,
      callback: any,
    ) => {
      process.nextTick(() => callback(null));
      return true;
    },
  ),
  assertQueue: vi
    .fn()
    .mockResolvedValue({ queue: "test-queue", messageCount: 0, consumerCount: 0 }),
});

const createState = (overrides?: Partial<RabbitSharedState>): RabbitSharedState => ({
  connection: null,
  publishChannel: createMockChannel() as any,
  consumeChannel: null,
  exchange: "iris",
  dlxExchange: "iris.dlx",
  dlqQueue: "iris.dlq",
  consumerRegistrations: [],
  assertedQueues: new Set(),
  assertedDelayQueues: new Set(),
  replyConsumerTags: [],
  reconnecting: false,
  prefetch: 10,
  inFlightCount: 0,
  ...overrides,
});

const makeMessage = (name: string): IMessage => ({ name }) as unknown as IMessage;

describe("publishRabbitMessages", () => {
  it("should throw when publish channel is not available", async () => {
    const state = createState({ publishChannel: null });
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await expect(
      publishRabbitMessages(makeMessage("Test"), undefined, driver, state, logger as any),
    ).rejects.toThrow(IrisPublishError);
  });

  it("should publish a single message to exchange", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRabbitMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    expect(driver.calls.prepared).toHaveLength(1);
    expect(driver.calls.completed).toHaveLength(1);
    expect(state.publishChannel!.publish).toHaveBeenCalledWith(
      "iris",
      "TestMessage",
      expect.any(Buffer),
      expect.objectContaining({ persistent: true }),
      expect.any(Function),
    );
  });

  it("should publish an array of messages", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRabbitMessages(
      [makeMessage("Test1"), makeMessage("Test2")],
      undefined,
      driver,
      state,
      logger as any,
    );

    expect(driver.calls.prepared).toHaveLength(2);
    expect(driver.calls.completed).toHaveLength(2);
    expect(state.publishChannel!.publish).toHaveBeenCalledTimes(2);
  });

  it("should publish to delay queue when delay is specified", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRabbitMessages(
      makeMessage("Test"),
      { delay: 5000 },
      driver,
      state,
      logger as any,
    );

    expect(state.publishChannel!.assertQueue).toHaveBeenCalledWith(
      "iris.delay.TestMessage",
      expect.objectContaining({
        durable: true,
        deadLetterExchange: "iris",
        deadLetterRoutingKey: "TestMessage",
      }),
    );

    expect(state.publishChannel!.publish).toHaveBeenCalledWith(
      "",
      "iris.delay.TestMessage",
      expect.any(Buffer),
      expect.objectContaining({ expiration: "5000" }),
      expect.any(Function),
    );
  });

  it("should not re-assert delay queue on subsequent publishes", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRabbitMessages(
      makeMessage("Test"),
      { delay: 1000 },
      driver,
      state,
      logger as any,
    );
    await publishRabbitMessages(
      makeMessage("Test"),
      { delay: 2000 },
      driver,
      state,
      logger as any,
    );

    expect(state.publishChannel!.assertQueue).toHaveBeenCalledTimes(1);
    expect(state.assertedDelayQueues.has("iris.delay.TestMessage")).toBe(true);
  });

  it("should set x-iris-priority header when priority is non-zero", async () => {
    const state = createState();
    const metadata = createMetadata({ priority: 5 });
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishRabbitMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const prepared = (driver.prepareForPublish as Mock).mock.results[0].value;
    const outbound = await prepared;
    expect(outbound.headers["x-iris-priority"]).toBe("5");
  });

  it("should not set x-iris-priority header when priority is 0", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRabbitMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const prepared = (driver.prepareForPublish as Mock).mock.results[0].value;
    const outbound = await prepared;
    expect(outbound.headers["x-iris-priority"]).toBeUndefined();
  });

  it("should use publish options priority over metadata", async () => {
    const state = createState();
    const metadata = createMetadata({ priority: 3 });
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishRabbitMessages(
      makeMessage("Test"),
      { priority: 7 },
      driver,
      state,
      logger as any,
    );

    const prepared = (driver.prepareForPublish as Mock).mock.results[0].value;
    const outbound = await prepared;
    expect(outbound.headers["x-iris-priority"]).toBe("7");
  });

  it("should use metadata delay when no publish options delay", async () => {
    const state = createState();
    const metadata = createMetadata({ delay: 3000 });
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishRabbitMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    expect(state.publishChannel!.publish).toHaveBeenCalledWith(
      "",
      "iris.delay.TestMessage",
      expect.any(Buffer),
      expect.objectContaining({ expiration: "3000" }),
      expect.any(Function),
    );
  });

  it("should sanitize routing key for topic with special chars", async () => {
    const state = createState();
    const metadata = createMetadata({
      topic: { callback: () => "orders/created@v2" },
    } as Partial<MessageMetadata>);
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishRabbitMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    expect(state.publishChannel!.publish).toHaveBeenCalledWith(
      "iris",
      "orders_created_v2",
      expect.any(Buffer),
      expect.any(Object),
      expect.any(Function),
    );
  });
});
