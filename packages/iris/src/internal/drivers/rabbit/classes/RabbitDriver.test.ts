import { EventEmitter } from "events";
import { RabbitDriver, type RabbitDriverOptions } from "./RabbitDriver";
import type { IrisConnectionState } from "../../../../types";

// ─── Mock amqplib ────────────────────────────────────────────────────────────

type MockChannel = EventEmitter & {
  prefetch: jest.Mock;
  assertExchange: jest.Mock;
  assertQueue: jest.Mock;
  bindQueue: jest.Mock;
  consume: jest.Mock;
  cancel: jest.Mock;
  unbindQueue: jest.Mock;
  close: jest.Mock;
  ack: jest.Mock;
  nack: jest.Mock;
  publish: jest.Mock;
};

type MockConnection = EventEmitter & {
  createConfirmChannel: jest.Mock;
  createChannel: jest.Mock;
  close: jest.Mock;
};

const createMockChannel = (): MockChannel => {
  const channel = new EventEmitter() as MockChannel;
  channel.prefetch = jest.fn().mockResolvedValue(undefined);
  channel.assertExchange = jest.fn().mockResolvedValue(undefined);
  channel.assertQueue = jest
    .fn()
    .mockResolvedValue({ queue: "q", messageCount: 0, consumerCount: 0 });
  channel.bindQueue = jest.fn().mockResolvedValue(undefined);
  channel.consume = jest.fn().mockResolvedValue({ consumerTag: "ctag-1" });
  channel.cancel = jest.fn().mockResolvedValue(undefined);
  channel.unbindQueue = jest.fn().mockResolvedValue(undefined);
  channel.close = jest.fn().mockResolvedValue(undefined);
  channel.ack = jest.fn();
  channel.nack = jest.fn();
  channel.publish = jest.fn((_ex, _rk, _buf, _opts, cb) => {
    process.nextTick(() => cb?.(null));
    return true;
  });
  return channel;
};

const createMockConnection = (
  publishChannel?: MockChannel,
  consumeChannel?: MockChannel,
): MockConnection => {
  const conn = new EventEmitter() as MockConnection;
  conn.createConfirmChannel = jest
    .fn()
    .mockResolvedValue(publishChannel ?? createMockChannel());
  conn.createChannel = jest.fn().mockResolvedValue(consumeChannel ?? createMockChannel());
  conn.close = jest.fn().mockResolvedValue(undefined);
  return conn;
};

let mockConnectFn: jest.Mock;

jest.mock("amqplib", () => ({
  __esModule: true,
  default: {
    connect: (...args: Array<unknown>) => mockConnectFn(...args),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createDriverOptions = (
  overrides?: Partial<RabbitDriverOptions>,
): RabbitDriverOptions => ({
  logger: createMockLogger() as any,
  getSubscribers: jest.fn().mockReturnValue([]),
  url: "amqp://localhost:5672",
  exchange: "test-exchange",
  ...overrides,
});

/**
 * Wait for a condition to become true, polling every 10ms.
 * Throws after timeoutMs if condition is never met.
 */
const waitFor = async (
  condition: () => boolean,
  timeoutMs: number = 5000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error("waitFor timed out");
    }
    await new Promise<void>((r) => setTimeout(r, 10));
  }
};

// ─── Tests ───────────────────────────────────────────────────────────────────

// We use real timers because the reconnect logic uses async callbacks inside setTimeout.
// To keep tests fast, we override Math.random to eliminate jitter.
// RECONNECT_BASE_DELAY is 1000ms, so we shorten it by patching the driver's internal
// _reconnectAttempt to manipulate delay values, or simply wait with generous timeouts.
//
// Instead, we'll directly invoke the reconnect path by emitting 'close' on the mock
// connection and waiting for the next connect call.

jest.setTimeout(30_000);

describe("RabbitDriver - reconnect logic", () => {
  let originalRandom: () => number;

  beforeEach(() => {
    mockConnectFn = jest.fn();
    originalRandom = Math.random;
    // Eliminate jitter so delays are predictable
    Math.random = () => 0;
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  describe("single failure then success", () => {
    test("should reconnect after connection close and re-register consumers", async () => {
      // First connect succeeds
      const conn1 = createMockConnection();
      mockConnectFn.mockResolvedValueOnce(conn1);

      const driver = new RabbitDriver(createDriverOptions());
      await driver.connect();

      expect(driver.getConnectionState()).toBe("connected");

      // Register a consumer so we can verify re-registration
      const state = (driver as any).state;
      state.consumerRegistrations.push({
        queue: "test-queue",
        consumerTag: "ctag-old",
        onMessage: jest.fn(),
        routingKey: "test.key",
        exchange: "test-exchange",
        queueOptions: { durable: true },
      });

      // Prepare second connection for reconnect
      const publishCh2 = createMockChannel();
      const consumeCh2 = createMockChannel();
      const conn2 = createMockConnection(publishCh2, consumeCh2);
      mockConnectFn.mockResolvedValueOnce(conn2);

      // Override reconnect attempt counter to make delay minimal
      // Delay = min(1000 * 2^(attempt-1), 30000) = 1000ms at attempt 1
      // With jitter=0, total delay = 1000ms

      // Simulate connection close (non-deliberate)
      conn1.emit("close");

      expect(driver.getConnectionState()).toBe("reconnecting");

      // Wait for reconnect to complete
      await waitFor(() => driver.getConnectionState() === "connected", 3000);

      expect(mockConnectFn).toHaveBeenCalledTimes(2);
      expect(driver.getConnectionState()).toBe("connected");

      // Verify exchange assertions happened on reconnect
      expect(publishCh2.assertExchange).toHaveBeenCalledWith("test-exchange", "topic", {
        durable: true,
      });

      // Verify consumer was re-registered on new consume channel
      expect(consumeCh2.assertQueue).toHaveBeenCalled();
      expect(consumeCh2.bindQueue).toHaveBeenCalled();
      expect(consumeCh2.consume).toHaveBeenCalled();
    });
  });

  describe("multiple failures with backoff", () => {
    test("should increase delay between reconnect attempts", async () => {
      const conn1 = createMockConnection();
      mockConnectFn.mockResolvedValueOnce(conn1);

      const driver = new RabbitDriver(createDriverOptions());
      await driver.connect();

      const logger = (driver as any).logger;
      const debugCalls: Array<{ attempt: number; delayMs: number }> = [];
      logger.debug = jest.fn((_msg: string, data?: any) => {
        if (data?.attempt !== undefined && data?.delayMs !== undefined) {
          debugCalls.push({ attempt: data.attempt, delayMs: data.delayMs });
        }
      });

      // Fail first 2 reconnect attempts
      mockConnectFn
        .mockRejectedValueOnce(new Error("connection refused 1"))
        .mockRejectedValueOnce(new Error("connection refused 2"));

      // Third attempt succeeds
      const conn3 = createMockConnection();
      mockConnectFn.mockResolvedValueOnce(conn3);

      // Simulate connection close
      conn1.emit("close");

      // Wait for all attempts to complete and succeed
      await waitFor(() => driver.getConnectionState() === "connected", 15000);

      expect(mockConnectFn).toHaveBeenCalledTimes(4); // initial + 3 reconnects

      // Verify delays increase exponentially
      // attempt 1: 1000ms, attempt 2: 2000ms, attempt 3: 4000ms
      expect(debugCalls).toHaveLength(3);
      expect(debugCalls[0].attempt).toBe(1);
      expect(debugCalls[0].delayMs).toBe(1000);
      expect(debugCalls[1].attempt).toBe(2);
      expect(debugCalls[1].delayMs).toBe(2000);
      expect(debugCalls[2].attempt).toBe(3);
      expect(debugCalls[2].delayMs).toBe(4000);
    });
  });

  describe("deliberate disconnect during reconnect", () => {
    test("should stop reconnect attempts when disconnect is called", async () => {
      const conn1 = createMockConnection();
      mockConnectFn.mockResolvedValueOnce(conn1);

      const driver = new RabbitDriver(createDriverOptions());
      await driver.connect();

      // Fail reconnect attempts indefinitely
      mockConnectFn.mockRejectedValue(new Error("connection refused"));

      // Simulate connection close
      conn1.emit("close");

      // Wait for first reconnect attempt to fire and fail
      await waitFor(() => mockConnectFn.mock.calls.length >= 2, 3000);

      // Deliberately disconnect
      await driver.disconnect();

      const callCountAfterDisconnect = mockConnectFn.mock.calls.length;

      // Wait a generous amount of time
      await new Promise<void>((r) => setTimeout(r, 3000));

      // Should not have attempted any more reconnects
      expect(mockConnectFn.mock.calls.length).toBe(callCountAfterDisconnect);
      expect(driver.getConnectionState()).toBe("disconnected");
    });
  });

  describe("exchange assertion failure after connect success", () => {
    test("should re-trigger reconnect when assertExchange fails after successful connect", async () => {
      const conn1 = createMockConnection();
      mockConnectFn.mockResolvedValueOnce(conn1);

      const driver = new RabbitDriver(createDriverOptions());
      await driver.connect();

      // Reconnect: connect succeeds but assertExchange fails
      const publishCh2 = createMockChannel();
      publishCh2.assertExchange.mockRejectedValueOnce(
        new Error("exchange assertion failed"),
      );
      const conn2 = createMockConnection(publishCh2);
      mockConnectFn.mockResolvedValueOnce(conn2);

      // Third attempt fully succeeds
      const conn3 = createMockConnection();
      mockConnectFn.mockResolvedValueOnce(conn3);

      // Simulate connection close
      conn1.emit("close");

      // Wait for the driver to eventually succeed
      await waitFor(() => driver.getConnectionState() === "connected", 10000);

      // Should have tried at least 3 times (initial + 2 reconnects)
      expect(mockConnectFn).toHaveBeenCalledTimes(3);

      // Verify the error was logged
      const logger = (driver as any).logger;
      expect(logger.error).toHaveBeenCalledWith(
        "Reconnect failed",
        expect.objectContaining({
          error: "exchange assertion failed",
        }),
      );
    });
  });

  describe("state transitions", () => {
    test("should notify state listeners during reconnect lifecycle", async () => {
      const conn1 = createMockConnection();
      mockConnectFn.mockResolvedValueOnce(conn1);

      const driver = new RabbitDriver(createDriverOptions());
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      const conn2 = createMockConnection();
      mockConnectFn.mockResolvedValueOnce(conn2);

      // Simulate connection close
      conn1.emit("close");

      // Wait for reconnect to complete
      await waitFor(() => driver.getConnectionState() === "connected", 3000);

      // States: connecting -> connected (initial), reconnecting (close),
      //         connecting -> connected (reconnect)
      expect(states).toEqual([
        "connecting",
        "connected",
        "reconnecting",
        "connecting",
        "connected",
      ]);
    });
  });
});

describe("RabbitDriver - return handler routes to DLX", () => {
  beforeEach(() => {
    mockConnectFn = jest.fn();
  });

  test("should publish returned message to DLX exchange", async () => {
    const publishChannel = createMockChannel();
    const conn = createMockConnection(publishChannel);
    mockConnectFn.mockResolvedValueOnce(conn);

    const driver = new RabbitDriver(createDriverOptions());
    await driver.connect();

    // Emit a "return" event on the publish channel
    publishChannel.emit("return", {
      fields: {
        routingKey: "test.routing.key",
        exchange: "test-exchange",
        replyText: "NO_ROUTE",
      },
      content: Buffer.from("message-body"),
      properties: {
        headers: { "x-custom": "value" },
        messageId: "msg-1",
      },
    });

    // The handler should re-publish to dlx exchange
    expect(publishChannel.publish).toHaveBeenCalledWith(
      "test-exchange.dlx",
      "test.routing.key",
      Buffer.from("message-body"),
      expect.objectContaining({
        headers: {
          "x-custom": "value",
          "x-iris-return-reason": "NO_ROUTE",
        },
        messageId: "msg-1",
        mandatory: false,
      }),
    );
  });

  test("should use default reason when replyText is missing", async () => {
    const publishChannel = createMockChannel();
    const conn = createMockConnection(publishChannel);
    mockConnectFn.mockResolvedValueOnce(conn);

    const driver = new RabbitDriver(createDriverOptions());
    await driver.connect();

    publishChannel.emit("return", {
      fields: {
        routingKey: "some.key",
        exchange: "test-exchange",
        replyText: undefined,
      },
      content: Buffer.from("body"),
      properties: {
        headers: {},
      },
    });

    expect(publishChannel.publish).toHaveBeenCalledWith(
      "test-exchange.dlx",
      "some.key",
      Buffer.from("body"),
      expect.objectContaining({
        headers: {
          "x-iris-return-reason": "unroutable",
        },
        mandatory: false,
      }),
    );
  });

  test("should handle null headers on returned message", async () => {
    const publishChannel = createMockChannel();
    const conn = createMockConnection(publishChannel);
    mockConnectFn.mockResolvedValueOnce(conn);

    const driver = new RabbitDriver(createDriverOptions());
    await driver.connect();

    publishChannel.emit("return", {
      fields: {
        routingKey: "key",
        exchange: "test-exchange",
        replyText: "NO_ROUTE",
      },
      content: Buffer.from("body"),
      properties: {
        headers: null,
      },
    });

    expect(publishChannel.publish).toHaveBeenCalledWith(
      "test-exchange.dlx",
      "key",
      Buffer.from("body"),
      expect.objectContaining({
        headers: {
          "x-iris-return-reason": "NO_ROUTE",
        },
        mandatory: false,
      }),
    );
  });

  test("should log error and not throw when DLX publish fails", async () => {
    const publishChannel = createMockChannel();
    publishChannel.publish.mockImplementation(() => {
      throw new Error("channel closed");
    });
    const conn = createMockConnection(publishChannel);
    mockConnectFn.mockResolvedValueOnce(conn);

    const driver = new RabbitDriver(createDriverOptions());
    await driver.connect();

    const logger = (driver as any).logger;

    // Should not throw
    expect(() => {
      publishChannel.emit("return", {
        fields: {
          routingKey: "key",
          exchange: "test-exchange",
          replyText: "NO_ROUTE",
        },
        content: Buffer.from("body"),
        properties: { headers: {} },
      });
    }).not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to forward returned message to DLX",
      expect.objectContaining({
        error: "channel closed",
        routingKey: "key",
      }),
    );
  });
});
