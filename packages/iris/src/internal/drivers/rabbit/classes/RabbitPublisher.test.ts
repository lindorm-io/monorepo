import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RabbitSharedState } from "../types/rabbit-types";
import { RabbitPublisher } from "./RabbitPublisher";

// --- Mocks ---
const mockPublishRabbitMessages = jest.fn().mockResolvedValue(undefined);
jest.mock("../utils/publish-messages", () => ({
  publishRabbitMessages: (...args: Array<unknown>) => mockPublishRabbitMessages(...args),
}));

// --- Test message ---

@Message({ name: "TckRabbitPubBasic" })
class TckRabbitPubBasic implements IMessage {
  @Field("string") body!: string;
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

const createMockState = (overrides?: Partial<RabbitSharedState>): RabbitSharedState => ({
  connection: {} as any,
  publishChannel: { publish: jest.fn() } as any,
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
