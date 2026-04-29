import type { IMessage } from "../../../../interfaces/index.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { OutboundPayload } from "../../../message/utils/prepare-outbound.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import {
  publishKafkaMessages,
  type KafkaPublishDriver,
} from "./publish-kafka-messages.js";
import { describe, expect, it, vi, type Mock } from "vitest";

vi.mock("./ensure-kafka-topic.js", async () => ({
  ensureKafkaTopicFromState: vi.fn().mockResolvedValue(undefined),
}));

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
): KafkaPublishDriver<IMessage> & {
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

const createMockProducer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
});

const createState = (overrides?: Partial<KafkaSharedState>): KafkaSharedState => ({
  kafka: null,
  admin: null,
  producer: createMockProducer() as any,
  connectionConfig: { brokers: ["localhost:9092"] },
  prefix: "iris",
  consumers: [],
  consumerRegistrations: [],
  consumerPool: new Map(),
  inFlightCount: 0,
  prefetch: 10,
  sessionTimeoutMs: 30000,
  acks: -1,
  createdTopics: new Set(),
  publishedTopics: new Set(),
  abortController: new AbortController(),
  resetGeneration: 0,
  ...overrides,
});

const createMockDelayManager = (): DelayManager & { scheduledCalls: Array<any> } => {
  const scheduledCalls: Array<any> = [];
  return {
    scheduledCalls,
    schedule: vi.fn(async (envelope: any, topic: string, delayMs: number) => {
      scheduledCalls.push({ envelope, topic, delayMs });
      return "delay-id";
    }),
    cancel: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    size: vi.fn(),
    close: vi.fn(),
  } as any;
};

const makeMessage = (name: string): IMessage => ({ name }) as unknown as IMessage;

describe("publishKafkaMessages", () => {
  it("should throw when producer is not available", async () => {
    const state = createState({ producer: null });
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await expect(
      publishKafkaMessages(makeMessage("Test"), undefined, driver, state, logger as any),
    ).rejects.toThrow(IrisPublishError);
  });

  it("should publish a single message via producer.send", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishKafkaMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    expect(driver.calls.prepared).toHaveLength(1);
    expect(driver.calls.completed).toHaveLength(1);
    expect(state.producer!.send).toHaveBeenCalledTimes(1);

    const sendArgs = (state.producer!.send as Mock).mock.calls[0][0];
    expect(sendArgs.topic).toBe("iris.TestMessage");
    expect(sendArgs.messages).toHaveLength(1);
  });

  it("should publish an array of messages", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishKafkaMessages(
      [makeMessage("Test1"), makeMessage("Test2")],
      undefined,
      driver,
      state,
      logger as any,
    );

    expect(driver.calls.prepared).toHaveLength(2);
    expect(driver.calls.completed).toHaveLength(2);
    expect(state.producer!.send).toHaveBeenCalledTimes(2);
  });

  it("should schedule delayed publish via delayManager", async () => {
    const state = createState();
    const delayManager = createMockDelayManager();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishKafkaMessages(
      makeMessage("Test"),
      { delay: 5000 },
      driver,
      state,
      logger as any,
      { delayManager },
    );

    expect(state.producer!.send).not.toHaveBeenCalled();
    expect(delayManager.schedule).toHaveBeenCalledTimes(1);
    expect(delayManager.scheduledCalls[0].delayMs).toBe(5000);
  });

  it("should publish immediately when delay > 0 but no delayManager", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishKafkaMessages(
      makeMessage("Test"),
      { delay: 5000 },
      driver,
      state,
      logger as any,
    );

    expect(state.producer!.send).toHaveBeenCalledTimes(1);
  });

  it("should set x-iris-priority header when priority is non-zero", async () => {
    const state = createState();
    const metadata = createMetadata({ priority: 5 });
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishKafkaMessages(
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

    await publishKafkaMessages(
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

    await publishKafkaMessages(
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
    const delayManager = createMockDelayManager();
    const driver = createDriver(metadata);
    const logger = createMockLogger();

    await publishKafkaMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
      { delayManager },
    );

    expect(state.producer!.send).not.toHaveBeenCalled();
    expect(delayManager.schedule).toHaveBeenCalledTimes(1);
    expect(delayManager.scheduledCalls[0].delayMs).toBe(3000);
  });

  it("should use custom prefix in topic name", async () => {
    const state = createState({ prefix: "myapp" });
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishKafkaMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const sendArgs = (state.producer!.send as Mock).mock.calls[0][0];
    expect(sendArgs.topic).toBe("myapp.TestMessage");
  });

  it("should pass acks from state to producer.send", async () => {
    const state = createState({ acks: 1 });
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishKafkaMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const sendArgs = (state.producer!.send as Mock).mock.calls[0][0];
    expect(sendArgs.acks).toBe(1);
  });

  it("should use default acks -1 from state", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishKafkaMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const sendArgs = (state.producer!.send as Mock).mock.calls[0][0];
    expect(sendArgs.acks).toBe(-1);
  });

  it("should include serialized headers in kafka message", async () => {
    const state = createState();
    const driver = createDriver(createMetadata());
    const logger = createMockLogger();

    await publishKafkaMessages(
      makeMessage("Test"),
      undefined,
      driver,
      state,
      logger as any,
    );

    const sendArgs = (state.producer!.send as Mock).mock.calls[0][0];
    const kafkaMessage = sendArgs.messages[0];
    expect(kafkaMessage.headers).toBeDefined();
    expect(kafkaMessage.headers["x-iris-topic"]).toBeDefined();
    expect(kafkaMessage.headers["x-iris-timestamp"]).toBeDefined();
  });
});
