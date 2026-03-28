import type { IMessage, IMessageSubscriber } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { NatsSharedState } from "../types/nats-types";
import { NatsPublisher } from "./NatsPublisher";

// --- Mock publish-nats-messages ---
const mockPublishNatsMessages = jest.fn().mockResolvedValue(undefined);
jest.mock("../utils/publish-nats-messages", () => ({
  publishNatsMessages: (...args: Array<unknown>) => mockPublishNatsMessages(...args),
}));

// --- Test message classes ---

@Message({ name: "TckNatsPubBasic" })
class TckNatsPubBasic implements IMessage {
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

const createMockState = (): NatsSharedState => ({
  nc: {} as any,
  js: {
    publish: jest
      .fn()
      .mockResolvedValue({ seq: 1, stream: "IRIS_IRIS", duplicate: false }),
    consumers: { get: jest.fn() },
  } as any,
  jsm: {
    streams: { info: jest.fn(), add: jest.fn(), purge: jest.fn() },
    consumers: {
      add: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
    },
  } as any,
  headersInit: jest
    .fn()
    .mockReturnValue({
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      values: jest.fn(),
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
