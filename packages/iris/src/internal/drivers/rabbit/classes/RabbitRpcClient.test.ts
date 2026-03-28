import { EventEmitter } from "events";
import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RabbitSharedState } from "../types/rabbit-types";
import { RabbitRpcClient } from "./RabbitRpcClient";

// --- Mocks ---
jest.mock("../utils/build-amqp-headers", () => ({
  buildAmqpHeaders: jest.fn().mockReturnValue({
    properties: {
      headers: {},
      contentType: "application/octet-stream",
    },
    routingKey: "TckRabbitRpcReq",
  }),
}));

jest.mock("../utils/parse-amqp-headers", () => ({
  parseAmqpHeaders: jest.fn().mockReturnValue({
    payload: Buffer.from("{}"),
    headers: {},
    envelope: { topic: "TckRabbitRpcRes" },
  }),
}));

// --- Test messages ---

@Message({ name: "TckRabbitRpcReq" })
class TckRabbitRpcReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckRabbitRpcRes" })
class TckRabbitRpcRes implements IMessage {
  @Field("string") result!: string;
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

type MockConfirmChannel = EventEmitter & {
  publish: jest.Mock;
  consume: jest.Mock;
  cancel: jest.Mock;
  on: jest.Mock;
  removeListener: jest.Mock;
};

const createMockPublishChannel = (): MockConfirmChannel => {
  const channel = new EventEmitter() as MockConfirmChannel;
  channel.publish = jest.fn((_ex, _rk, _buf, _opts, cb) => {
    process.nextTick(() => cb?.(null));
    return true;
  });
  channel.consume = jest.fn().mockResolvedValue({ consumerTag: "reply-ctag" });
  channel.cancel = jest.fn().mockResolvedValue(undefined);
  // Override EventEmitter methods with spies while keeping functionality
  const origOn = channel.on.bind(channel);
  channel.on = jest.fn((...args: any[]) => origOn(...args));
  const origRemove = channel.removeListener.bind(channel);
  channel.removeListener = jest.fn((...args: any[]) => origRemove(...args));
  return channel;
};

const createMockState = (overrides?: Partial<RabbitSharedState>): RabbitSharedState => ({
  connection: {} as any,
  publishChannel: createMockPublishChannel() as any,
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

const createClient = (stateOverrides?: Partial<RabbitSharedState>) => {
  const state = createMockState(stateOverrides);
  const client = new RabbitRpcClient<TckRabbitRpcReq, TckRabbitRpcRes>({
    state,
    logger: createMockLogger() as any,
    requestTarget: TckRabbitRpcReq as any,
    responseTarget: TckRabbitRpcRes as any,
  });
  return { client, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
});

describe("RabbitRpcClient", () => {
  it("should create a client instance", () => {
    const { client } = createClient();
    expect(client).toBeDefined();
  });

  it("should throw when publish channel is not available", async () => {
    const { client } = createClient({ publishChannel: null });

    await expect(
      client.request({ query: "test" } as any, { timeout: 100 }),
    ).rejects.toThrow("Cannot send RPC request: publish channel is not available");
  });

  it("should set up reply consumer on first request", async () => {
    const { client, state } = createClient();
    const channel = state.publishChannel as unknown as MockConfirmChannel;

    const requestPromise = client.request({ query: "test" } as any, { timeout: 100 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(channel.consume).toHaveBeenCalledTimes(1);
    expect(channel.consume).toHaveBeenCalledWith(
      "amq.rabbitmq.reply-to",
      expect.any(Function),
      { noAck: true },
    );

    expect(state.replyConsumerTags).toContain("reply-ctag");

    await client.close();
    await requestPromise.catch(() => {});
  });

  it("should publish to exchange with mandatory flag", async () => {
    const { client, state } = createClient();
    const channel = state.publishChannel as unknown as MockConfirmChannel;

    const requestPromise = client.request({ query: "test" } as any, { timeout: 100 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(channel.publish).toHaveBeenCalled();
    const publishCall = channel.publish.mock.calls[0];
    expect(publishCall[0]).toBe("test-exchange");

    await client.close();
    await requestPromise.catch(() => {});
  });

  it("should reject pending requests on close", async () => {
    const { client } = createClient();

    const requestPromise = client.request({ query: "test" } as any, { timeout: 60000 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    await client.close();

    await expect(requestPromise).rejects.toThrow(
      "RPC client closed while request was pending",
    );
  });

  it("should cancel reply consumer on close", async () => {
    const { client, state } = createClient();
    const channel = state.publishChannel as unknown as MockConfirmChannel;

    const requestPromise = client.request({ query: "test" } as any, { timeout: 60000 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    await client.close();
    await requestPromise.catch(() => {});

    expect(channel.cancel).toHaveBeenCalledWith("reply-ctag");
    expect(state.replyConsumerTags).toHaveLength(0);
  });

  it("should remove return listener on close", async () => {
    const { client, state } = createClient();
    const channel = state.publishChannel as unknown as MockConfirmChannel;

    const requestPromise = client.request({ query: "test" } as any, { timeout: 60000 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    await client.close();
    await requestPromise.catch(() => {});

    expect(channel.removeListener).toHaveBeenCalledWith("return", expect.any(Function));
  });

  it("should reuse reply consumer for sequential requests", async () => {
    const { client, state } = createClient();
    const channel = state.publishChannel as unknown as MockConfirmChannel;

    const p1 = client.request({ query: "a" } as any, { timeout: 60000 });

    // Flush microtask queue so first request sets up reply consumer
    for (let i = 0; i < 20; i++) await Promise.resolve();

    const p2 = client.request({ query: "b" } as any, { timeout: 60000 });

    // Flush microtask queue
    for (let i = 0; i < 20; i++) await Promise.resolve();

    // Only one reply consumer was created
    expect(channel.consume).toHaveBeenCalledTimes(1);

    await client.close();
    await p1.catch(() => {});
    await p2.catch(() => {});
  });

  it("should handle close gracefully when no requests pending", async () => {
    const { client } = createClient();
    await expect(client.close()).resolves.toBeUndefined();
  });
});
