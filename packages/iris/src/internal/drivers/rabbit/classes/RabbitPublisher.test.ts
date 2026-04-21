import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { RabbitPublisher } from "./RabbitPublisher.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---
const mockPublishRabbitMessages = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/publish-messages.js", async () => ({
  publishRabbitMessages: (...args: Array<unknown>) => mockPublishRabbitMessages(...args),
}));

// --- Test message ---

@Message({ name: "TckRabbitPubBasic" })
class TckRabbitPubBasic implements IMessage {
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

const createMockState = (overrides?: Partial<RabbitSharedState>): RabbitSharedState => ({
  connection: {} as any,
  publishChannel: { publish: vi.fn() } as any,
  consumeChannel: null,
  exchange: "test-exchange",
  dlxExchange: "test-exchange.dlx",
  dlqQueue: "test-exchange.dlq",
  consumerRegistrations: [],
  assertedQueues: new Set(),
  assertedDelayQueues: new Set(),
  replyConsumerTags: [],
  reconnecting: false,
  prefetch: 10,
  inFlightCount: 0,
  ...overrides,
});

const createPublisher = (stateOverrides?: Partial<RabbitSharedState>) => {
  const state = createMockState(stateOverrides);
  const publisher = new RabbitPublisher<TckRabbitPubBasic>({
    target: TckRabbitPubBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { publisher, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockPublishRabbitMessages.mockClear();
});

describe("RabbitPublisher", () => {
  describe("publish", () => {
    it("should call publishRabbitMessages", async () => {
      const { publisher } = createPublisher();
      const msg = publisher.create({ body: "hello" });
      await publisher.publish(msg);
      expect(mockPublishRabbitMessages).toHaveBeenCalledTimes(1);
    });

    it("should pass message as first argument", async () => {
      const { publisher } = createPublisher();
      const msg = publisher.create({ body: "hello" });
      await publisher.publish(msg);
      expect(mockPublishRabbitMessages.mock.calls[0][0]).toBe(msg);
    });

    it("should pass options through to publishRabbitMessages", async () => {
      const { publisher } = createPublisher();
      const msg = publisher.create({ body: "test" });
      await publisher.publish(msg, { delay: 3000 });
      expect(mockPublishRabbitMessages.mock.calls[0][1]).toEqual({ delay: 3000 });
    });

    it("should pass state to publishRabbitMessages", async () => {
      const { publisher, state } = createPublisher();
      const msg = publisher.create({ body: "test" });
      await publisher.publish(msg);
      expect(mockPublishRabbitMessages.mock.calls[0][3]).toBe(state);
    });

    it("should forward array of messages", async () => {
      const { publisher } = createPublisher();
      const msg1 = publisher.create({ body: "first" });
      const msg2 = publisher.create({ body: "second" });
      await publisher.publish([msg1, msg2]);
      expect(mockPublishRabbitMessages).toHaveBeenCalledTimes(1);
      expect(mockPublishRabbitMessages.mock.calls[0][0]).toEqual([msg1, msg2]);
    });

    it("should propagate errors from publishRabbitMessages", async () => {
      mockPublishRabbitMessages.mockRejectedValueOnce(
        new Error("Publish channel not available"),
      );
      const { publisher } = createPublisher();
      const msg = publisher.create({ body: "test" });
      await expect(publisher.publish(msg)).rejects.toThrow(
        "Publish channel not available",
      );
    });
  });
});
