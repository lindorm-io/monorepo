import type { IMessage, IMessageSubscriber } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RedisSharedState } from "../types/redis-types";
import { RedisPublisher } from "./RedisPublisher";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mock publish-redis-messages ---
const mockPublishRedisMessages = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/publish-redis-messages", async () => ({
  publishRedisMessages: (...args: Array<unknown>) => mockPublishRedisMessages(...args),
}));

// --- Test message classes ---

@Message({ name: "TckRedisPubBasic" })
class TckRedisPubBasic implements IMessage {
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

const createMockState = (): RedisSharedState => ({
  publishConnection: { xadd: vi.fn() } as any,
  connectionConfig: { url: "redis://localhost:6379" },
  prefix: "iris",
  consumerName: "iris:test:1:abcd1234",
  consumerLoops: [],
  consumerRegistrations: [],
  createdGroups: new Set(),
  publishedStreams: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  blockMs: 5000,
  maxStreamLength: null,
});

const createPublisher = (opts?: { subscribers?: Array<IMessageSubscriber> }) => {
  const state = createMockState();
  const publisher = new RedisPublisher<TckRedisPubBasic>({
    target: TckRedisPubBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => opts?.subscribers ?? [],
    state,
    delayManager: undefined,
  });
  return { publisher, state };
};

// --- Tests ---

describe("RedisPublisher", () => {
  beforeEach(() => {
    clearRegistry();
    mockPublishRedisMessages.mockClear();
  });

  it("should call publishRedisMessages on publish", async () => {
    const { publisher } = createPublisher();
    const msg = publisher.create({ body: "hello" });
    await publisher.publish(msg);

    expect(mockPublishRedisMessages).toHaveBeenCalledTimes(1);
  });

  it("should call publishRedisMessages with array", async () => {
    const { publisher } = createPublisher();
    const msg1 = publisher.create({ body: "first" });
    const msg2 = publisher.create({ body: "second" });
    await publisher.publish([msg1, msg2]);

    expect(mockPublishRedisMessages).toHaveBeenCalledTimes(1);
    expect(mockPublishRedisMessages.mock.calls[0][0]).toEqual([msg1, msg2]);
  });

  it("should pass options through to publishRedisMessages", async () => {
    const { publisher } = createPublisher();
    const msg = publisher.create({ body: "test" });
    await publisher.publish(msg, { delay: 5000 });

    expect(mockPublishRedisMessages).toHaveBeenCalledTimes(1);
    expect(mockPublishRedisMessages.mock.calls[0][1]).toEqual({ delay: 5000 });
  });

  it("should pass state to publishRedisMessages", async () => {
    const { publisher, state } = createPublisher();
    const msg = publisher.create({ body: "test" });
    await publisher.publish(msg);

    expect(mockPublishRedisMessages.mock.calls[0][3]).toBe(state);
  });
});
