import type { IMessage, IMessageSubscriber } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { NatsSharedState } from "../types/nats-types.js";
import { NatsPublisher } from "./NatsPublisher.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mock publish-nats-messages ---
const mockPublishNatsMessages = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/publish-nats-messages.js", async () => ({
  publishNatsMessages: (...args: Array<unknown>) => mockPublishNatsMessages(...args),
}));

// --- Test message classes ---

@Message({ name: "TckNatsPubBasic" })
class TckNatsPubBasic implements IMessage {
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

const createMockState = (): NatsSharedState => ({
  nc: {} as any,
  js: {
    publish: vi.fn().mockResolvedValue({ seq: 1, stream: "IRIS_IRIS", duplicate: false }),
    consumers: { get: vi.fn() },
  } as any,
  jsm: {
    streams: { info: vi.fn(), add: vi.fn(), purge: vi.fn() },
    consumers: {
      add: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(true),
    },
  } as any,
  headersInit: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    values: vi.fn(),
  }) as any,
  prefix: "iris",
  streamName: "IRIS_IRIS",
  consumerLoops: [],
  consumerRegistrations: [],
  ensuredConsumers: new Set(),
  inFlightCount: 0,
  prefetch: 10,
});

const createPublisher = (opts?: { subscribers?: Array<IMessageSubscriber> }) => {
  const state = createMockState();
  const publisher = new NatsPublisher<TckNatsPubBasic>({
    target: TckNatsPubBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => opts?.subscribers ?? [],
    state,
    delayManager: undefined,
  });
  return { publisher, state };
};

// --- Tests ---

describe("NatsPublisher", () => {
  beforeEach(() => {
    clearRegistry();
    mockPublishNatsMessages.mockClear();
  });

  it("should call publishNatsMessages on publish", async () => {
    const { publisher } = createPublisher();
    const msg = publisher.create({ body: "hello" });
    await publisher.publish(msg);

    expect(mockPublishNatsMessages).toHaveBeenCalledTimes(1);
  });

  it("should call publishNatsMessages with array", async () => {
    const { publisher } = createPublisher();
    const msg1 = publisher.create({ body: "first" });
    const msg2 = publisher.create({ body: "second" });
    await publisher.publish([msg1, msg2]);

    expect(mockPublishNatsMessages).toHaveBeenCalledTimes(1);
    expect(mockPublishNatsMessages.mock.calls[0][0]).toEqual([msg1, msg2]);
  });

  it("should pass options through to publishNatsMessages", async () => {
    const { publisher } = createPublisher();
    const msg = publisher.create({ body: "test" });
    await publisher.publish(msg, { delay: 5000 });

    expect(mockPublishNatsMessages).toHaveBeenCalledTimes(1);
    expect(mockPublishNatsMessages.mock.calls[0][1]).toEqual({ delay: 5000 });
  });

  it("should pass state to publishNatsMessages", async () => {
    const { publisher, state } = createPublisher();
    const msg = publisher.create({ body: "test" });
    await publisher.publish(msg);

    expect(mockPublishNatsMessages.mock.calls[0][3]).toBe(state);
  });
});
