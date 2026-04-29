import type { IMessage, IMessageSubscriber } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { KafkaPublisher } from "./KafkaPublisher.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mock publish-kafka-messages ---
const mockPublishKafkaMessages = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/publish-kafka-messages.js", async () => ({
  publishKafkaMessages: (...args: Array<unknown>) => mockPublishKafkaMessages(...args),
}));

// --- Test message classes ---

@Message({ name: "TckKafkaPubBasic" })
class TckKafkaPubBasic implements IMessage {
  @Field("string") body!: string;
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

const createMockState = (): KafkaSharedState => ({
  kafka: null,
  admin: null,
  producer: { send: vi.fn(), connect: vi.fn(), disconnect: vi.fn() } as any,
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
});

const createPublisher = (opts?: { subscribers?: Array<IMessageSubscriber> }) => {
  const state = createMockState();
  const publisher = new KafkaPublisher<TckKafkaPubBasic>({
    target: TckKafkaPubBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => opts?.subscribers ?? [],
    state,
    delayManager: undefined,
  });
  return { publisher, state };
};

// --- Tests ---

describe("KafkaPublisher", () => {
  beforeEach(() => {
    clearRegistry();
    mockPublishKafkaMessages.mockClear();
  });

  it("should call publishKafkaMessages on publish", async () => {
    const { publisher } = createPublisher();
    const msg = publisher.create({ body: "hello" });
    await publisher.publish(msg);

    expect(mockPublishKafkaMessages).toHaveBeenCalledTimes(1);
  });

  it("should call publishKafkaMessages with array", async () => {
    const { publisher } = createPublisher();
    const msg1 = publisher.create({ body: "first" });
    const msg2 = publisher.create({ body: "second" });
    await publisher.publish([msg1, msg2]);

    expect(mockPublishKafkaMessages).toHaveBeenCalledTimes(1);
    expect(mockPublishKafkaMessages.mock.calls[0][0]).toEqual([msg1, msg2]);
  });

  it("should pass options through to publishKafkaMessages", async () => {
    const { publisher } = createPublisher();
    const msg = publisher.create({ body: "test" });
    await publisher.publish(msg, { delay: 5000 });

    expect(mockPublishKafkaMessages).toHaveBeenCalledTimes(1);
    expect(mockPublishKafkaMessages.mock.calls[0][1]).toEqual({ delay: 5000 });
  });

  it("should pass state to publishKafkaMessages", async () => {
    const { publisher, state } = createPublisher();
    const msg = publisher.create({ body: "test" });
    await publisher.publish(msg);

    expect(mockPublishKafkaMessages.mock.calls[0][3]).toBe(state);
  });
});
