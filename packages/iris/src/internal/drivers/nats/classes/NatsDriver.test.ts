import type { IMessage, IMessageSubscriber } from "../../../../interfaces";
import type { IrisConnectionState } from "../../../../types";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { NatsSharedState } from "../types/nats-types";
import { NatsDriver } from "./NatsDriver";
import { NatsPublisher } from "./NatsPublisher";
import { NatsMessageBus } from "./NatsMessageBus";
import { NatsWorkerQueue } from "./NatsWorkerQueue";
import { NatsStreamProcessor } from "./NatsStreamProcessor";
import { NatsRpcClient } from "./NatsRpcClient";
import { NatsRpcServer } from "./NatsRpcServer";

// --- Mock nats module ---

let statusIteratorDone = false;
let statusIteratorValues: Array<{ type: string; data?: unknown }> = [];

const mockNc = {
  jetstream: jest.fn(),
  jetstreamManager: jest.fn(),
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
  request: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  drain: jest.fn().mockResolvedValue(undefined),
  status: jest.fn().mockReturnValue(
    (async function* () {
      while (!statusIteratorDone) {
        if (statusIteratorValues.length > 0) {
          yield statusIteratorValues.shift()!;
        } else {
          // Wait briefly then exit to avoid infinite loop in tests
          await new Promise<void>((r) => setTimeout(r, 10));
          return;
        }
      }
    })(),
  ),
  isClosed: jest.fn().mockReturnValue(false),
};

const mockJs = {
  publish: jest.fn().mockResolvedValue({ seq: 1, stream: "IRIS_IRIS", duplicate: false }),
  consumers: { get: jest.fn() },
};

const mockJsm = {
  streams: {
    info: jest.fn().mockResolvedValue({}),
    add: jest.fn().mockResolvedValue({}),
    purge: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
  consumers: {
    add: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue(true),
  },
};

const mockHeaders = jest.fn().mockReturnValue({
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  values: jest.fn(),
});

mockNc.jetstream.mockReturnValue(mockJs);
mockNc.jetstreamManager.mockResolvedValue(mockJsm);

jest.mock("nats", () => ({
  __esModule: true,
  connect: jest.fn().mockResolvedValue(mockNc),
  headers: mockHeaders,
}));

// --- Test message classes ---

@Message({ name: "TckNatsDriverBasic" })
class TckNatsDriverBasic implements IMessage {
  @Field("string") body!: string;
}

@Message({ name: "TckNatsDriverReq" })
class TckNatsDriverReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckNatsDriverRes" })
class TckNatsDriverRes implements IMessage {
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

const createDriver = (subscribers?: Array<IMessageSubscriber>) => {
  const subs: Array<IMessageSubscriber> = subscribers ?? [];
  return new NatsDriver({
    logger: createMockLogger() as any,
    getSubscribers: () => subs,
    servers: "nats://localhost:4222",
  });
};

// --- Tests ---

describe("NatsDriver", () => {
  beforeEach(() => {
    clearRegistry();
    jest.clearAllMocks();
    statusIteratorDone = false;
    statusIteratorValues = [];

    // Reset the status mock for each test
    mockNc.status.mockReturnValue(
      (async function* () {
        while (!statusIteratorDone) {
          if (statusIteratorValues.length > 0) {
            yield statusIteratorValues.shift()!;
          } else {
            await new Promise<void>((r) => setTimeout(r, 10));
            return;
          }
        }
      })(),
    );
  });

  describe("lifecycle", () => {
    it("should connect successfully", async () => {
      const driver = createDriver();
      await driver.connect();
      expect(driver.connected).toBe(true);
      expect(driver.getConnectionState()).toBe("connected");
    });

    it("should disconnect", async () => {
      const driver = createDriver();
      await driver.connect();
      await driver.disconnect();
      expect(driver.connected).toBe(false);
      expect(driver.getConnectionState()).toBe("disconnected");
    });

    it("should return true from ping when connected", async () => {
      const driver = createDriver();
      await driver.connect();
      expect(await driver.ping()).toBe(true);
    });

    it("should return false from ping when not connected", async () => {
      const driver = createDriver();
      expect(await driver.ping()).toBe(false);
    });

    it("should return false from ping when flush throws", async () => {
      const driver = createDriver();
      await driver.connect();
      mockNc.flush.mockRejectedValueOnce(new Error("flush error"));
      expect(await driver.ping()).toBe(false);
    });

    it("should setup by ensuring stream exists", async () => {
      const driver = createDriver();
      await driver.connect();
      await driver.setup([TckNatsDriverBasic]);
      expect(mockJsm.streams.info).toHaveBeenCalledWith("IRIS_IRIS");
    });

    it("should drain successfully", async () => {
      const driver = createDriver();
      await driver.connect();
      await expect(driver.drain(100)).resolves.toBeUndefined();
      expect(driver.getConnectionState()).toBe("connected");
    });

    it("should reset state and purge stream", async () => {
      const driver = createDriver();
      await driver.connect();
      (driver as any).state.ensuredConsumers.add("test-consumer");

      await driver.reset();

      expect((driver as any).state.ensuredConsumers.size).toBe(0);
      expect((driver as any).state.consumerLoops).toHaveLength(0);
      expect(mockJsm.streams.delete).toHaveBeenCalledWith("IRIS_IRIS");
    });

    it("should handle disconnect when nc.close() throws", async () => {
      const driver = createDriver();
      await driver.connect();
      mockNc.close.mockRejectedValueOnce(new Error("already closed"));
      await expect(driver.disconnect()).resolves.toBeUndefined();
      expect(driver.getConnectionState()).toBe("disconnected");
    });

    it("should set connection state to disconnected when connect fails", async () => {
      const { connect } = jest.requireMock("nats") as any;
      connect.mockRejectedValueOnce(new Error("connection refused"));

      const driver = createDriver();
      await expect(driver.connect()).rejects.toThrow("connection refused");
      expect(driver.getConnectionState()).toBe("disconnected");
    });
  });

  describe("state listeners", () => {
    it("should notify listeners on state change", async () => {
      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      expect(states).toContain("connecting");
      expect(states).toContain("connected");
    });
  });

  describe("cloneWithGetters", () => {
    it("should share the same state instance", async () => {
      const driver = createDriver();
      await driver.connect();

      const cloned = driver.cloneWithGetters(() => []);
      expect((cloned as any).state).toBe((driver as any).state);
    });

    it("should use the provided getSubscribers function", async () => {
      const driver = createDriver();
      await driver.connect();

      const sub: IMessageSubscriber = { beforePublish: jest.fn() };
      const cloned = driver.cloneWithGetters(() => [sub]) as NatsDriver;
      expect((cloned as any).getSubscribers()).toEqual([sub]);
    });
  });

  describe("factory methods", () => {
    it("should create NatsPublisher via createPublisher", async () => {
      const driver = createDriver();
      await driver.connect();
      const publisher = driver.createPublisher(TckNatsDriverBasic);
      expect(publisher).toBeInstanceOf(NatsPublisher);
    });

    it("should create NatsMessageBus via createMessageBus", async () => {
      const driver = createDriver();
      await driver.connect();
      const bus = driver.createMessageBus(TckNatsDriverBasic);
      expect(bus).toBeInstanceOf(NatsMessageBus);
    });

    it("should create NatsWorkerQueue via createWorkerQueue", async () => {
      const driver = createDriver();
      await driver.connect();
      const queue = driver.createWorkerQueue(TckNatsDriverBasic);
      expect(queue).toBeInstanceOf(NatsWorkerQueue);
    });

    it("should create NatsStreamProcessor via createStreamProcessor", async () => {
      const driver = createDriver();
      await driver.connect();
      const processor = driver.createStreamProcessor();
      expect(processor).toBeInstanceOf(NatsStreamProcessor);
    });

    it("should create NatsRpcClient via createRpcClient", async () => {
      const driver = createDriver();
      await driver.connect();
      const client = driver.createRpcClient(TckNatsDriverReq, TckNatsDriverRes);
      expect(client).toBeInstanceOf(NatsRpcClient);
    });

    it("should create NatsRpcServer via createRpcServer", async () => {
      const driver = createDriver();
      await driver.connect();
      const server = driver.createRpcServer(TckNatsDriverReq, TckNatsDriverRes);
      expect(server).toBeInstanceOf(NatsRpcServer);
    });
  });

  describe("reply queue", () => {
    it("should track reply queue state", async () => {
      const driver = createDriver();
      await driver.connect();

      expect(driver.replyQueueActive).toBe(false);

      await driver.setupReplyQueue();
      expect(driver.replyQueueActive).toBe(true);

      await driver.teardownReplyQueue();
      expect(driver.replyQueueActive).toBe(false);
    });
  });

  describe("reconnection", () => {
    it("should set state to reconnecting on disconnect status event", async () => {
      statusIteratorValues = [{ type: "disconnect" }];

      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      // Allow the status monitor to process
      await new Promise<void>((r) => setTimeout(r, 50));

      expect(states).toContain("reconnecting");
    });

    it("should set state to reconnecting on staleconnection status event", async () => {
      statusIteratorValues = [{ type: "staleconnection" }];

      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      await new Promise<void>((r) => setTimeout(r, 50));

      expect(states).toContain("reconnecting");
    });

    it("should not set reconnecting state after deliberate disconnect", async () => {
      // Delay the status event so disconnect happens first
      statusIteratorValues = [];

      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();
      await driver.disconnect();

      // Late status events should be ignored (monitor is aborted)
      const statesAfterDisconnect = [...states];
      expect(statesAfterDisconnect).not.toContain("reconnecting");
    });
  });

  describe("constructor defaults", () => {
    it("should use default prefix", () => {
      const driver = createDriver();
      expect((driver as any).state.prefix).toBe("iris");
    });

    it("should use default prefetch", () => {
      const driver = createDriver();
      expect((driver as any).state.prefetch).toBe(10);
    });

    it("should compute stream name from prefix", () => {
      const driver = createDriver();
      expect((driver as any).state.streamName).toBe("IRIS_IRIS");
    });

    it("should accept custom prefix", () => {
      const driver = new NatsDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        servers: "nats://localhost:4222",
        prefix: "myapp",
      });
      expect((driver as any).state.prefix).toBe("myapp");
      expect((driver as any).state.streamName).toBe("IRIS_MYAPP");
    });

    it("should accept custom prefetch", () => {
      const driver = new NatsDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        servers: "nats://localhost:4222",
        prefetch: 25,
      });
      expect((driver as any).state.prefetch).toBe(25);
    });

    it("should accept servers as array", () => {
      const driver = new NatsDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        servers: ["nats://host1:4222", "nats://host2:4222"],
      });
      expect((driver as any).servers).toEqual(["nats://host1:4222", "nats://host2:4222"]);
    });
  });

  describe("drain timeout", () => {
    it("should warn when drain times out with in-flight messages", async () => {
      const logger = createMockLogger();
      const driver = new NatsDriver({
        logger: logger as any,
        getSubscribers: () => [],
        servers: "nats://localhost:4222",
      });

      await driver.connect();

      // Simulate in-flight messages
      (driver as any).state.inFlightCount = 5;

      await driver.drain(50);

      expect(logger.warn).toHaveBeenCalledWith(
        "Drain timeout reached with in-flight consumers remaining",
        expect.objectContaining({ inFlightCount: 5 }),
      );
    });
  });

  describe("reset edge cases", () => {
    it("should handle delete failure gracefully", async () => {
      const driver = createDriver();
      await driver.connect();
      mockJsm.streams.delete.mockRejectedValueOnce(new Error("delete failed"));

      await expect(driver.reset()).resolves.toBeUndefined();
    });

    it("should clear reply queue state on reset", async () => {
      const driver = createDriver();
      await driver.connect();
      await driver.setupReplyQueue();
      expect(driver.replyQueueActive).toBe(true);

      await driver.reset();
      expect(driver.replyQueueActive).toBe(false);
    });
  });
});
