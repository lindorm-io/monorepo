import { ZephyrError } from "../errors/ZephyrError";
import type { ZephyrMiddleware } from "../types/context";
import type { ZephyrOptions } from "../types/options";
import { Zephyr } from "./Zephyr";

jest.mock("@lindorm/random", () => ({
  randomUUID: jest.fn().mockReturnValue("mock-uuid"),
}));

const mockSocket = {
  auth: undefined as any,
  connected: false,
  id: "mock-socket-id",
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  timeout: jest.fn(),
  io: {
    on: jest.fn(),
  },
};

jest.mock("socket.io-client", () => ({
  io: jest.fn(() => mockSocket),
}));

const { io } = jest.requireMock("socket.io-client");

const createOptions = (overrides?: Partial<ZephyrOptions>): ZephyrOptions => ({
  url: "http://test.example.com",
  alias: "test-app",
  ...overrides,
});

const findLastCall = (mock: jest.Mock, event: string): Array<any> | undefined => {
  const calls = mock.mock.calls.filter(([e]: [string]) => e === event);
  return calls[calls.length - 1];
};

const simulateConnect = (): void => {
  mockSocket.connected = true;

  const call = findLastCall(mockSocket.once, "connect");
  if (call) {
    call[1]();
  }
};

const simulateDisconnect = (): void => {
  mockSocket.connected = false;

  const call = findLastCall(mockSocket.once, "disconnect");
  if (call) {
    call[1]("io server disconnect");
  }
};

const connectZephyr = async (zephyr: Zephyr): Promise<void> => {
  const connectPromise = zephyr.connect();

  // For async auth, we need to wait a tick for the bearer to resolve
  // before simulateConnect fires (connect registrations happen after auth)
  await new Promise((resolve) => setImmediate(resolve));

  simulateConnect();

  await connectPromise;
};

describe("Zephyr", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.auth = undefined;
    mockSocket.timeout.mockReturnValue({
      emitWithAck: jest.fn(),
    });
  });

  describe("constructor", () => {
    it("should store options correctly", () => {
      const logger = { child: jest.fn().mockReturnThis() } as any;
      const middleware: Array<ZephyrMiddleware> = [
        async (ctx, next) => {
          await next();
        },
      ];

      const zephyr = new Zephyr(
        createOptions({
          logger,
          middleware,
          namespace: "/admin",
          timeout: 10000,
          environment: "development",
        }),
      );

      expect(logger.child).toHaveBeenCalledWith(["Zephyr"]);
      expect(zephyr.connected).toBe(false);
      expect(zephyr.id).toBeUndefined();
    });

    it("should default autoConnect to false", () => {
      new Zephyr(createOptions());

      expect(io).not.toHaveBeenCalled();
    });
  });

  describe("connect", () => {
    it("should create socket and resolve on connect event", async () => {
      const zephyr = new Zephyr(createOptions());

      await connectZephyr(zephyr);

      expect(io).toHaveBeenCalledWith("http://test.example.com", {
        autoConnect: false,
      });
      expect(mockSocket.connect).toHaveBeenCalled();
      expect(zephyr.connected).toBe(true);
    });

    it("should include namespace in URL", async () => {
      const zephyr = new Zephyr(createOptions({ namespace: "/admin" }));

      await connectZephyr(zephyr);

      expect(io).toHaveBeenCalledWith(
        "http://test.example.com/admin",
        expect.any(Object),
      );
    });

    it("should pass socket options through", async () => {
      const zephyr = new Zephyr(
        createOptions({
          socketOptions: { transports: ["websocket"] } as any,
        }),
      );

      await connectZephyr(zephyr);

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transports: ["websocket"],
          autoConnect: false,
        }),
      );
    });

    it("should reject on connect_error", async () => {
      const zephyr = new Zephyr(createOptions());

      const connectPromise = zephyr.connect();

      await new Promise((resolve) => setImmediate(resolve));

      const call = findLastCall(mockSocket.once, "connect_error");
      call![1](new Error("Connection refused"));

      await expect(connectPromise).rejects.toThrow(ZephyrError);
    });

    it("should call auth.prepareHandshake before socket.connect", async () => {
      const order: Array<string> = [];
      const auth = {
        prepareHandshake: jest.fn(async (socket: any) => {
          order.push("prepareHandshake");
          socket.auth = { bearer: "static-token" };
        }),
        refresh: jest.fn(),
      };
      mockSocket.connect.mockImplementation(() => {
        order.push("socket.connect");
      });

      const zephyr = new Zephyr(createOptions({ auth }));

      await connectZephyr(zephyr);

      expect(auth.prepareHandshake).toHaveBeenCalledTimes(1);
      expect(mockSocket.auth).toEqual({ bearer: "static-token" });
      expect(order).toEqual(["prepareHandshake", "socket.connect"]);
    });

    it("should not create a new socket if already connected", async () => {
      const zephyr = new Zephyr(createOptions());

      await connectZephyr(zephyr);

      await zephyr.connect();

      expect(io).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnect", () => {
    it("should call socket.disconnect and resolve on disconnect event", async () => {
      const zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);

      const disconnectPromise = zephyr.disconnect();
      simulateDisconnect();

      await disconnectPromise;

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should resolve immediately if no socket exists", async () => {
      const zephyr = new Zephyr(createOptions());

      await expect(zephyr.disconnect()).resolves.toBeUndefined();
    });
  });

  describe("connected", () => {
    it("should return false when no socket", () => {
      const zephyr = new Zephyr(createOptions());
      expect(zephyr.connected).toBe(false);
    });

    it("should return socket.connected value", async () => {
      const zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);

      expect(zephyr.connected).toBe(true);
    });
  });

  describe("id", () => {
    it("should return undefined when no socket", () => {
      const zephyr = new Zephyr(createOptions());
      expect(zephyr.id).toBeUndefined();
    });

    it("should return socket.id when connected", async () => {
      const zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);

      expect(zephyr.id).toBe("mock-socket-id");
    });
  });

  describe("emit", () => {
    let zephyr: Zephyr;

    beforeEach(async () => {
      zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);
    });

    it("should send Pylon envelope", async () => {
      await zephyr.emit("test:event", { key: "value" });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "test:event",
        expect.objectContaining({
          __pylon: true,
          header: expect.objectContaining({
            correlationId: "mock-uuid",
          }),
          payload: { key: "value" },
        }),
      );
    });

    it("should send empty payload when no data", async () => {
      await zephyr.emit("test:event");

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "test:event",
        expect.objectContaining({
          payload: {},
        }),
      );
    });

    it("should run middleware in correct order", async () => {
      const order: Array<string> = [];

      const zephyrWithMiddleware = new Zephyr(
        createOptions({
          middleware: [
            async (_ctx, next) => {
              order.push("before-1");
              await next();
              order.push("after-1");
            },
            async (_ctx, next) => {
              order.push("before-2");
              await next();
              order.push("after-2");
            },
          ],
        }),
      );

      await connectZephyr(zephyrWithMiddleware);

      await zephyrWithMiddleware.emit("test:event", {});

      expect(order).toMatchSnapshot();
    });

    it("should throw when not connected", async () => {
      const disconnected = new Zephyr(createOptions());

      await expect(disconnected.emit("test:event")).rejects.toThrow(
        "Socket is not connected",
      );
    });
  });

  describe("request", () => {
    let zephyr: Zephyr;
    let emitWithAck: jest.Mock;

    beforeEach(async () => {
      emitWithAck = jest.fn();
      mockSocket.timeout.mockReturnValue({ emitWithAck });

      zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);
    });

    it("should send envelope and unwrap ack response", async () => {
      emitWithAck.mockResolvedValue({
        __pylon: true,
        ok: true,
        data: { id: "123", name: "test" },
      });

      const result = await zephyr.request("users:find", { id: "123" });

      expect(mockSocket.timeout).toHaveBeenCalledWith(5000);
      expect(emitWithAck).toHaveBeenCalledWith(
        "users:find",
        expect.objectContaining({
          __pylon: true,
          payload: { id: "123" },
        }),
      );
      expect(result).toEqual({ id: "123", name: "test" });
    });

    it("should throw ZephyrError on nack", async () => {
      emitWithAck.mockResolvedValue({
        __pylon: true,
        ok: false,
        error: {
          message: "Not found",
          code: "NOT_FOUND",
          title: "Resource Not Found",
          data: { id: "123" },
        },
      });

      await expect(zephyr.request("users:find", { id: "123" })).rejects.toThrow(
        ZephyrError,
      );

      try {
        await zephyr.request("users:find", { id: "123" });
      } catch (err: any) {
        expect(err).toMatchSnapshot();
      }
    });

    it("should throw ZephyrError with default message on nack without message", async () => {
      emitWithAck.mockResolvedValue({
        __pylon: true,
        ok: false,
        error: {},
      });

      await expect(zephyr.request("test:event")).rejects.toThrow("Request failed");
    });

    it("should use custom timeout", async () => {
      emitWithAck.mockResolvedValue({
        __pylon: true,
        ok: true,
        data: {},
      });

      await zephyr.request("test:event", {}, { timeout: 15000 });

      expect(mockSocket.timeout).toHaveBeenCalledWith(15000);
    });

    it("should use constructor timeout as default", async () => {
      emitWithAck.mockResolvedValue({
        __pylon: true,
        ok: true,
        data: {},
      });

      const customZephyr = new Zephyr(createOptions({ timeout: 8000 }));
      await connectZephyr(customZephyr);

      await customZephyr.request("test:event");

      expect(mockSocket.timeout).toHaveBeenCalledWith(8000);
    });

    it("should passthrough raw response without __pylon flag", async () => {
      emitWithAck.mockResolvedValue({ raw: "data" });

      const result = await zephyr.request("legacy:event");

      expect(result).toEqual({ raw: "data" });
    });

    it("should throw when not connected", async () => {
      const disconnected = new Zephyr(createOptions());

      await expect(disconnected.request("test:event")).rejects.toThrow(
        "Socket is not connected",
      );
    });
  });

  describe("on", () => {
    it("should register handler on connected socket", async () => {
      const zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);

      const handler = jest.fn();
      zephyr.on("test:event", handler);

      expect(mockSocket.on).toHaveBeenCalledWith("test:event", expect.any(Function));
    });

    it("should queue handler before connect", async () => {
      const zephyr = new Zephyr(createOptions());
      const handler = jest.fn();

      zephyr.on("test:event", handler);

      // Not yet registered on the socket since we haven't connected
      const callsBefore = mockSocket.on.mock.calls.filter(
        ([e]: [string]) => e === "test:event",
      );
      expect(callsBefore).toHaveLength(0);

      await connectZephyr(zephyr);

      const callsAfter = mockSocket.on.mock.calls.filter(
        ([e]: [string]) => e === "test:event",
      );
      expect(callsAfter).toHaveLength(1);
    });

    it("should wrap handler with middleware chain", async () => {
      const order: Array<string> = [];

      const zephyr = new Zephyr(
        createOptions({
          middleware: [
            async (_ctx, next) => {
              order.push("middleware");
              await next();
            },
          ],
        }),
      );

      await connectZephyr(zephyr);

      const handler = jest.fn(() => {
        order.push("handler");
      });
      zephyr.on("test:event", handler);

      const call = findLastCall(mockSocket.on, "test:event");
      const wrappedHandler = call![1];

      wrappedHandler({ result: "data" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(order).toMatchSnapshot();
    });
  });

  describe("once", () => {
    it("should register handler with socket.once", async () => {
      const zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);

      const handler = jest.fn();
      zephyr.once("test:event", handler);

      expect(mockSocket.once).toHaveBeenCalledWith("test:event", expect.any(Function));
    });

    it("should queue once handler before connect", async () => {
      const zephyr = new Zephyr(createOptions());
      const handler = jest.fn();

      zephyr.once("test:event", handler);

      await connectZephyr(zephyr);

      const calls = mockSocket.once.mock.calls.filter(
        ([e]: [string]) => e === "test:event",
      );
      expect(calls).toHaveLength(1);
    });
  });

  describe("off", () => {
    it("should remove correct handler", async () => {
      const zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);

      const handler = jest.fn();
      zephyr.on("test:event", handler);

      zephyr.off("test:event", handler);

      expect(mockSocket.off).toHaveBeenCalledWith("test:event", expect.any(Function));
    });

    it("should remove all handlers for event when no handler given", async () => {
      const zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);

      const handler1 = jest.fn();
      const handler2 = jest.fn();
      zephyr.on("test:event", handler1);
      zephyr.on("test:event", handler2);

      zephyr.off("test:event");

      const offCalls = mockSocket.off.mock.calls.filter(
        ([e]: [string]) => e === "test:event",
      );
      expect(offCalls).toHaveLength(2);
    });

    it("should be a no-op for unknown events", () => {
      const zephyr = new Zephyr(createOptions());

      expect(() => zephyr.off("unknown:event")).not.toThrow();
    });
  });

  describe("error handling for on() handlers", () => {
    it("should call onError handlers when middleware throws", async () => {
      const errorHandler = jest.fn();

      const zephyr = new Zephyr(
        createOptions({
          middleware: [
            async () => {
              throw new Error("Middleware failure");
            },
          ],
        }),
      );

      zephyr.onError(errorHandler);

      await connectZephyr(zephyr);

      const handler = jest.fn();
      zephyr.on("test:event", handler);

      const call = findLastCall(mockSocket.on, "test:event");
      call![1]({ data: "test" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(ZephyrError));
      expect(handler).not.toHaveBeenCalled();
    });

    it("should fall back to logger.error when no onError handler", async () => {
      const logger = {
        child: jest.fn().mockReturnThis(),
        error: jest.fn(),
      } as any;

      const zephyr = new Zephyr(
        createOptions({
          logger,
          middleware: [
            async () => {
              throw new Error("Middleware failure");
            },
          ],
        }),
      );

      await connectZephyr(zephyr);

      const handler = jest.fn();
      zephyr.on("test:event", handler);

      const call = findLastCall(mockSocket.on, "test:event");
      call![1]({ data: "test" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.error).toHaveBeenCalledWith(
        "Unhandled Zephyr error",
        expect.objectContaining({ error: expect.any(ZephyrError) }),
      );
    });
  });

  describe("lifecycle hooks", () => {
    it("should call onConnect handlers on connect", async () => {
      const handler = jest.fn();
      const zephyr = new Zephyr(createOptions());
      zephyr.onConnect(handler);

      await connectZephyr(zephyr);

      const call = findLastCall(mockSocket.on, "connect");
      call![1]();

      expect(handler).toHaveBeenCalled();
    });

    it("should call onDisconnect handlers on disconnect", async () => {
      const handler = jest.fn();
      const zephyr = new Zephyr(createOptions());
      zephyr.onDisconnect(handler);

      await connectZephyr(zephyr);

      const call = findLastCall(mockSocket.on, "disconnect");
      call![1]("io server disconnect");

      expect(handler).toHaveBeenCalledWith("io server disconnect");
    });

    it("should call onReconnect handlers on reconnect", async () => {
      const handler = jest.fn();
      const zephyr = new Zephyr(createOptions());
      zephyr.onReconnect(handler);

      await connectZephyr(zephyr);

      const call = findLastCall(mockSocket.io.on, "reconnect");
      call![1](3);

      expect(handler).toHaveBeenCalledWith(3);
    });

    it("should call auth.prepareHandshake again on reconnect_attempt", async () => {
      const prepareHandshake = jest
        .fn()
        .mockImplementationOnce(async (socket: any) => {
          socket.auth = { bearer: "token-1" };
        })
        .mockImplementationOnce(async (socket: any) => {
          socket.auth = { bearer: "token-2" };
        });

      const auth = { prepareHandshake, refresh: jest.fn() };

      const zephyr = new Zephyr(createOptions({ auth }));

      await connectZephyr(zephyr);

      expect(mockSocket.auth).toEqual({ bearer: "token-1" });

      const call = findLastCall(mockSocket.io.on, "reconnect_attempt");
      call![1](1);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(prepareHandshake).toHaveBeenCalledTimes(2);
      expect(mockSocket.auth).toEqual({ bearer: "token-2" });
    });
  });

  describe("refresh", () => {
    it("should delegate to auth.refresh with the socket", async () => {
      const auth = {
        prepareHandshake: jest.fn().mockResolvedValue(undefined),
        refresh: jest.fn().mockResolvedValue(undefined),
      };

      const zephyr = new Zephyr(createOptions({ auth }));
      await connectZephyr(zephyr);

      await zephyr.refresh();

      expect(auth.refresh).toHaveBeenCalledTimes(1);
      expect(auth.refresh).toHaveBeenCalledWith(mockSocket);
    });

    it("should debounce concurrent refresh calls", async () => {
      let resolveInner: (() => void) | undefined;
      const auth = {
        prepareHandshake: jest.fn().mockResolvedValue(undefined),
        refresh: jest
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise<void>((resolve) => {
                resolveInner = resolve;
              }),
          )
          .mockResolvedValue(undefined),
      };

      const zephyr = new Zephyr(createOptions({ auth }));
      await connectZephyr(zephyr);

      const p1 = zephyr.refresh();
      const p2 = zephyr.refresh();

      expect(auth.refresh).toHaveBeenCalledTimes(1);

      resolveInner!();
      await Promise.all([p1, p2]);

      await zephyr.refresh();
      expect(auth.refresh).toHaveBeenCalledTimes(2);
    });

    it("should throw when no auth strategy is configured", async () => {
      const zephyr = new Zephyr(createOptions());
      await connectZephyr(zephyr);

      await expect(zephyr.refresh()).rejects.toThrow("No auth strategy configured");
    });
  });

  describe("onAuthExpired", () => {
    const fireAuthExpired = (payload: any): void => {
      const call = findLastCall(mockSocket.on, "$pylon/auth/expired");
      call![1](payload);
    };

    it("should fire registered handlers on $pylon/auth/expired", async () => {
      const auth = {
        prepareHandshake: jest.fn().mockResolvedValue(undefined),
        refresh: jest.fn().mockResolvedValue(undefined),
      };

      const zephyr = new Zephyr(createOptions({ auth }));
      await connectZephyr(zephyr);

      const handler1 = jest.fn();
      const handler2 = jest.fn();
      zephyr.onAuthExpired(handler1);
      zephyr.onAuthExpired(handler2);

      fireAuthExpired({ expiresAt: 12345 });

      expect(handler1).toHaveBeenCalledWith({ expiresAt: 12345 });
      expect(handler2).toHaveBeenCalledWith({ expiresAt: 12345 });
    });

    it("should unsubscribe via returned function", async () => {
      const auth = {
        prepareHandshake: jest.fn().mockResolvedValue(undefined),
        refresh: jest.fn().mockResolvedValue(undefined),
      };

      const zephyr = new Zephyr(createOptions({ auth }));
      await connectZephyr(zephyr);

      const handler = jest.fn();
      const unsub = zephyr.onAuthExpired(handler);
      unsub();

      fireAuthExpired({ expiresAt: 1 });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should auto-trigger refresh on $pylon/auth/expired by default", async () => {
      const auth = {
        prepareHandshake: jest.fn().mockResolvedValue(undefined),
        refresh: jest.fn().mockResolvedValue(undefined),
      };

      const zephyr = new Zephyr(createOptions({ auth }));
      await connectZephyr(zephyr);

      fireAuthExpired({ expiresAt: 1 });

      await new Promise((r) => setTimeout(r, 10));

      expect(auth.refresh).toHaveBeenCalledTimes(1);
    });

    it("should not auto-refresh when autoRefreshOnExpiry is false", async () => {
      const auth = {
        prepareHandshake: jest.fn().mockResolvedValue(undefined),
        refresh: jest.fn().mockResolvedValue(undefined),
      };

      const zephyr = new Zephyr(createOptions({ auth, autoRefreshOnExpiry: false }));
      await connectZephyr(zephyr);

      fireAuthExpired({ expiresAt: 1 });

      await new Promise((r) => setTimeout(r, 10));

      expect(auth.refresh).not.toHaveBeenCalled();
    });
  });
});
