import type { IMessage } from "../../../../interfaces";
import type { MessageMetadata } from "../../../message/types/metadata";
import type { OutboundPayload } from "../../../message/utils/prepare-outbound";
import type { DelayManager } from "../../../delay/DelayManager";
import type { RedisSharedState } from "../types/redis-types";
import { IrisPublishError } from "../../../../errors/IrisPublishError";
import { publishRedisMessages, type RedisPublishDriver } from "./publish-redis-messages";

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
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
): RedisPublishDriver<IMessage> & {
  calls: { prepared: Array<IMessage>; completed: Array<IMessage> };
} => {
  const calls = { prepared: [] as Array<IMessage>, completed: [] as Array<IMessage> };
  return {
    metadata,
    calls,
    prepareForPublish: jest.fn(async (message: IMessage): Promise<OutboundPayload> => {
      calls.prepared.push(message);
      return { payload: Buffer.from("test-payload"), headers: {} };
    }),
    completePublish: jest.fn(async (message: IMessage): Promise<void> => {
      calls.completed.push(message);
    }),
  };
};

const createMockConnection = () => ({
  xadd: jest.fn().mockResolvedValue("1700000000000-0"),
  xreadgroup: jest.fn().mockResolvedValue(null),
  xack: jest.fn().mockResolvedValue(1),
  xgroup: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
  duplicate: jest.fn(),
  disconnect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
});

const createState = (overrides?: Partial<RedisSharedState>): RedisSharedState => ({
  publishConnection: createMockConnection() as any,
  connectionConfig: { url: "redis://localhost:6379" },
  prefix: "iris",
  consumerName: "iris:localhost:1234:abcdef01",
  consumerLoops: [],
  consumerRegistrations: [],
  createdGroups: new Set(),
  publishedStreams: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  blockMs: 2000,
  maxStreamLength: null,
  ...overrides,
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

const makeMessage = (name: string): IMessage => ({ name }) as unknown as IMessage;

describe("publishRedisMessages", () => {
  it("should throw when publish connection is not available", async () => {
    const state = createState({ publishConnection: null });
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await expect(
      publishRedisMessages(makeMessage("Test"), undefined, driver, state, logger as any),
    ).rejects.toThrow(IrisPublishError);
  });

  it("should publish a single message via XADD", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    expect(driver.calls.prepared).toHaveLength(1);
    expect(driver.calls.completed).toHaveLength(1);
    expect(state.publishConnection!.xadd).toHaveBeenCalledTimes(1);

    const xaddArgs = (state.publishConnection!.xadd as jest.Mock).mock.calls[0];
    expect(xaddArgs[0]).toBe("iris:TestMessage");
    expect(xaddArgs[1]).toBe("*");
  });

  it("should publish an array of messages", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      [makeMessage("Test1"), makeMessage("Test2")],
      undefined,
      driver,
      state,
      logger as any,
    );

    expect(driver.calls.prepared).toHaveLength(2);
    expect(driver.calls.completed).toHaveLength(2);
    expect(state.publishConnection!.xadd).toHaveBeenCalledTimes(2);
  });

  it("should include MAXLEN when maxStreamLength is set", async () => {
    const state = createState({ maxStreamLength: 10000 });
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const xaddArgs = (state.publishConnection!.xadd as jest.Mock).mock.calls[0];
    expect(xaddArgs[0]).toBe("iris:TestMessage");
    expect(xaddArgs[1]).toBe("MAXLEN");
    expect(xaddArgs[2]).toBe("~");
    expect(xaddArgs[3]).toBe(10000);
    expect(xaddArgs[4]).toBe("*");
  });

  it("should not include MAXLEN when maxStreamLength is null", async () => {
    const state = createState({ maxStreamLength: null });
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const xaddArgs = (state.publishConnection!.xadd as jest.Mock).mock.calls[0];
    expect(xaddArgs).not.toContain("MAXLEN");
  });

  it("should schedule delayed publish via delayManager", async () => {
    const state = createState();
    const delayManager = createMockDelayManager();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      { delay: 5000 },
      driver,
      state,
      logger as any,
      { delayManager },
    );

    expect(state.publishConnection!.xadd).not.toHaveBeenCalled();
    expect(delayManager.schedule).toHaveBeenCalledTimes(1);
    expect(delayManager.scheduledCalls[0].delayMs).toBe(5000);
  });

  it("should publish immediately when delay > 0 but no delayManager", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      { delay: 5000 },
      driver,
      state,
      logger as any,
    );

    expect(state.publishConnection!.xadd).toHaveBeenCalledTimes(1);
  });

  it("should set x-iris-priority header when priority is non-zero", async () => {
    const state = createState();
    const metadata = createMetadata({ priority: 5 });
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const prepared = (driver.prepareForPublish as jest.Mock).mock.results[0].value;
    const outbound = await prepared;
    expect(outbound.headers["x-iris-priority"]).toBe("5");
  });

  it("should not set x-iris-priority header when priority is 0", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const prepared = (driver.prepareForPublish as jest.Mock).mock.results[0].value;
    const outbound = await prepared;
    expect(outbound.headers["x-iris-priority"]).toBeUndefined();
  });

  it("should use publish options priority over metadata", async () => {
    const state = createState();
    const metadata = createMetadata({ priority: 3 });
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      { priority: 7 },
      driver,
      state,
      logger as any,
    );

    const prepared = (driver.prepareForPublish as jest.Mock).mock.results[0].value;
    const outbound = await prepared;
    expect(outbound.headers["x-iris-priority"]).toBe("7");
  });

  it("should use metadata delay when no publish options delay", async () => {
    const state = createState();
    const metadata = createMetadata({ delay: 3000 });
    const delayManager = createMockDelayManager();
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
      { delayManager },
    );

    expect(state.publishConnection!.xadd).not.toHaveBeenCalled();
    expect(delayManager.schedule).toHaveBeenCalledTimes(1);
    expect(delayManager.scheduledCalls[0].delayMs).toBe(3000);
  });

  it("should use custom prefix in stream key", async () => {
    const state = createState({ prefix: "myapp" });
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const xaddArgs = (state.publishConnection!.xadd as jest.Mock).mock.calls[0];
    expect(xaddArgs[0]).toBe("myapp:TestMessage");
  });

  it("should include serialized fields in XADD", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishRedisMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const xaddArgs = (state.publishConnection!.xadd as jest.Mock).mock.calls[0];
    // After stream key and *, there should be field-value pairs
    const fieldsStart = xaddArgs.indexOf("*") + 1;
    const fields = xaddArgs.slice(fieldsStart);
    expect(fields).toContain("payload");
    expect(fields).toContain("topic");
    expect(fields).toContain("headers");
    expect(fields).toContain("timestamp");
  });
});
