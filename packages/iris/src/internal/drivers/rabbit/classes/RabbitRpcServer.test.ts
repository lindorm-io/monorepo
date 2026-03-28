import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RabbitSharedState } from "../types/rabbit-types";
import { RabbitRpcServer } from "./RabbitRpcServer";

// --- Mocks ---
jest.mock("../utils/build-amqp-headers", () => ({
  buildAmqpHeaders: jest.fn().mockReturnValue({
    properties: {
      headers: {},
      contentType: "application/octet-stream",
    },
    routingKey: "TckRabbitRpcSrvReq",
  }),
}));

jest.mock("../utils/parse-amqp-headers", () => ({
  parseAmqpHeaders: jest.fn().mockReturnValue({
    payload: Buffer.from("{}"),
    headers: {},
    envelope: { topic: "TckRabbitRpcSrvReq" },
  }),
}));

// --- Test messages ---

@Message({ name: "TckRabbitRpcSrvReq" })
class TckRabbitRpcSrvReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckRabbitRpcSrvRes" })
class TckRabbitRpcSrvRes implements IMessage {
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

const createMockChannel = () => ({
  assertQueue: jest
    .fn()
    .mockResolvedValue({ queue: "rpc-queue", messageCount: 0, consumerCount: 0 }),
  bindQueue: jest.fn().mockResolvedValue(undefined),
  consume: jest.fn().mockResolvedValue({ consumerTag: "srv-ctag" }),
  cancel: jest.fn().mockResolvedValue(undefined),
  ack: jest.fn(),
  nack: jest.fn(),
  publish: jest.fn(),
});

const createMockState = (overrides?: Partial<RabbitSharedState>): RabbitSharedState => ({
  connection: {} as any,
  publishChannel: { publish: jest.fn() } as any,
  consumeChannel: createMockChannel() as any,
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

const createServer = (stateOverrides?: Partial<RabbitSharedState>) => {
  const state = createMockState(stateOverrides);
  const server = new RabbitRpcServer<TckRabbitRpcSrvReq, TckRabbitRpcSrvRes>({
    state,
    logger: createMockLogger() as any,
    requestTarget: TckRabbitRpcSrvReq as any,
    responseTarget: TckRabbitRpcSrvRes as any,
  });
  return { server, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
});

describe("RabbitRpcServer", () => {
  describe("serve", () => {
    it("should assert queue and start consuming", async () => {
      const { server, state } = createServer();
      const channel = state.consumeChannel!;

      await server.serve(async (req: any) => ({ result: req.query }) as any);

      expect(channel.assertQueue).toHaveBeenCalledWith(
        "test-exchange.rpc.TckRabbitRpcSrvReq",
        { durable: true },
      );
      expect(channel.bindQueue).toHaveBeenCalledWith(
        "test-exchange.rpc.TckRabbitRpcSrvReq",
        "test-exchange",
        "TckRabbitRpcSrvReq",
      );
      expect(channel.consume).toHaveBeenCalledTimes(1);
    });

    it("should register consumer in state.consumerRegistrations", async () => {
      const { server, state } = createServer();

      await server.serve(async (req: any) => ({ result: req.query }) as any);

      expect(state.consumerRegistrations).toHaveLength(1);
      expect(state.consumerRegistrations[0]).toMatchSnapshot();
    });

    it("should add queue to assertedQueues", async () => {
      const { server, state } = createServer();

      await server.serve(async (req: any) => ({ result: req.query }) as any);

      expect(state.assertedQueues.has("test-exchange.rpc.TckRabbitRpcSrvReq")).toBe(true);
    });

    it("should throw when handler already registered for same queue", async () => {
      const { server } = createServer();

      await server.serve(async (req: any) => ({ result: "a" }) as any);

      await expect(
        server.serve(async (req: any) => ({ result: "b" }) as any),
      ).rejects.toThrow("RPC handler already registered");
    });

    it("should throw when consume channel is not available", async () => {
      const { server } = createServer({ consumeChannel: null });

      await expect(server.serve(async () => ({ result: "x" }) as any)).rejects.toThrow(
        "Cannot serve RPC: consume channel is not available",
      );
    });

    it("should serve with custom queue name", async () => {
      const { server, state } = createServer();
      const channel = state.consumeChannel!;

      await server.serve(async (req: any) => ({ result: req.query }) as any, {
        queue: "custom-queue",
      });

      expect(channel.assertQueue).toHaveBeenCalledWith("test-exchange.rpc.custom-queue", {
        durable: true,
      });
    });

    it("should not re-assert queue if already asserted", async () => {
      const { server, state } = createServer();
      state.assertedQueues.add("test-exchange.rpc.TckRabbitRpcSrvReq");
      const channel = state.consumeChannel!;

      await server.serve(async (req: any) => ({ result: req.query }) as any);

      expect(channel.assertQueue).not.toHaveBeenCalled();
      expect(channel.bindQueue).not.toHaveBeenCalled();
      expect(channel.consume).toHaveBeenCalledTimes(1);
    });
  });

  describe("unserve", () => {
    it("should cancel consumer and remove registration", async () => {
      const { server, state } = createServer();
      const channel = state.consumeChannel!;

      await server.serve(async (req: any) => ({ result: req.query }) as any);

      expect(state.consumerRegistrations).toHaveLength(1);

      await server.unserve();

      expect(channel.cancel).toHaveBeenCalledWith("srv-ctag");
      expect(state.consumerRegistrations).toHaveLength(0);
    });

    it("should allow re-registering after unserve", async () => {
      const { server, state } = createServer();

      await server.serve(async (req: any) => ({ result: "a" }) as any);
      await server.unserve();

      // Should not throw — queue is now free
      await expect(
        server.serve(async (req: any) => ({ result: "b" }) as any),
      ).resolves.toBeUndefined();
    });

    it("should be a no-op when nothing is served", async () => {
      const { server } = createServer();
      await expect(server.unserve()).resolves.toBeUndefined();
    });
  });

  describe("unserveAll", () => {
    it("should cancel all owned handlers", async () => {
      const { server, state } = createServer();
      const channel = state.consumeChannel!;

      await server.serve(async (req: any) => ({ result: req.query }) as any);

      expect(state.consumerRegistrations).toHaveLength(1);

      await server.unserveAll();

      expect(channel.cancel).toHaveBeenCalledWith("srv-ctag");
      expect(state.consumerRegistrations).toHaveLength(0);
    });

    it("should clear all registered queues", async () => {
      const { server } = createServer();

      await server.serve(async (req: any) => ({ result: req.query }) as any);

      await server.unserveAll();

      // Should be able to re-register
      await expect(
        server.serve(async (req: any) => ({ result: "x" }) as any),
      ).resolves.toBeUndefined();
    });
  });
});
