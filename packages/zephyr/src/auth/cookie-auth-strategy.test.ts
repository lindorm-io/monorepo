import type { Socket } from "socket.io-client";
import { ZephyrError } from "../errors/ZephyrError";
import { createCookieAuthStrategy } from "./cookie-auth-strategy";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from "vitest";

type MockSocket = {
  socket: Socket;
  timeout: Mock;
  io: { opts: Record<string, unknown> };
};

const createMockSocket = (emitWithAck: Mock): MockSocket => {
  const timeout = vi.fn().mockReturnValue({ emitWithAck });
  const io = { opts: {} as Record<string, unknown> };
  const socket = {
    auth: undefined as unknown,
    timeout,
    io,
  } as unknown as Socket;
  return { socket, timeout, io };
};

const createResponse = (
  init: { ok: boolean; status?: number; body?: string } = { ok: true },
): Response =>
  ({
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    text: vi.fn().mockResolvedValue(init.body ?? ""),
  }) as unknown as Response;

describe("createCookieAuthStrategy", () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("prepareHandshake", () => {
    it("should set socket.io.opts.withCredentials to true", async () => {
      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket, io } = createMockSocket(vi.fn());

      await strategy.prepareHandshake(socket);

      expect(io.opts).toMatchSnapshot();
    });

    it("should preserve existing opts when enabling withCredentials", async () => {
      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket, io } = createMockSocket(vi.fn());
      io.opts.transports = ["websocket"];
      io.opts.reconnection = true;

      await strategy.prepareHandshake(socket);

      expect(io.opts).toMatchSnapshot();
    });

    it("should not touch socket.auth", async () => {
      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket } = createMockSocket(vi.fn());

      await strategy.prepareHandshake(socket);

      expect(socket.auth).toBeUndefined();
    });
  });

  describe("refresh", () => {
    it("should POST to refreshUrl with credentials include and emit refresh event", async () => {
      fetchSpy.mockResolvedValue(createResponse({ ok: true }));
      const emitWithAck = vi.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket, timeout } = createMockSocket(emitWithAck);

      await strategy.refresh(socket);

      expect(fetchSpy).toHaveBeenCalledWith("https://example.test/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      expect(timeout).toHaveBeenCalledWith(5000);
      expect(emitWithAck).toHaveBeenCalledWith("$pylon/auth/refresh", {});
    });

    it("should merge refreshFetchInit into the fetch call", async () => {
      fetchSpy.mockResolvedValue(createResponse({ ok: true }));
      const emitWithAck = vi.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
        refreshFetchInit: {
          headers: { "x-trace-id": "abc-123" },
        },
      });
      const { socket } = createMockSocket(emitWithAck);

      await strategy.refresh(socket);

      expect(fetchSpy).toHaveBeenCalledWith("https://example.test/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "x-trace-id": "abc-123" },
      });
    });

    it("should honour custom refreshAckTimeoutMs", async () => {
      fetchSpy.mockResolvedValue(createResponse({ ok: true }));
      const emitWithAck = vi.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
        refreshAckTimeoutMs: 2500,
      });
      const { socket, timeout } = createMockSocket(emitWithAck);

      await strategy.refresh(socket);

      expect(timeout).toHaveBeenCalledWith(2500);
    });

    it("should throw ZEPHYR_COOKIE_REFRESH_FETCH_FAILED when response is not ok", async () => {
      fetchSpy.mockResolvedValue(
        createResponse({ ok: false, status: 401, body: "Unauthorized" }),
      );
      const emitWithAck = vi.fn();

      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket } = createMockSocket(emitWithAck);

      let caught: ZephyrError | undefined;
      try {
        await strategy.refresh(socket);
      } catch (err) {
        caught = err as ZephyrError;
      }

      expect(caught).toBeInstanceOf(ZephyrError);
      expect(caught?.code).toBe("ZEPHYR_COOKIE_REFRESH_FETCH_FAILED");
      expect(caught?.status).toBe(401);
      expect(emitWithAck).not.toHaveBeenCalled();
    });

    it("should throw ZEPHYR_COOKIE_REFRESH_FETCH_ERROR when fetch itself rejects", async () => {
      fetchSpy.mockRejectedValue(new Error("network down"));
      const emitWithAck = vi.fn();

      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket } = createMockSocket(emitWithAck);

      let caught: ZephyrError | undefined;
      try {
        await strategy.refresh(socket);
      } catch (err) {
        caught = err as ZephyrError;
      }

      expect(caught).toBeInstanceOf(ZephyrError);
      expect(caught?.code).toBe("ZEPHYR_COOKIE_REFRESH_FETCH_ERROR");
      expect(emitWithAck).not.toHaveBeenCalled();
    });

    it("should throw and preserve envelope fields when ack is { ok: false }", async () => {
      fetchSpy.mockResolvedValue(createResponse({ ok: true }));
      const emitWithAck = vi.fn().mockResolvedValue({
        __pylon: true,
        ok: false,
        error: {
          code: "AUTH_REFRESH_REJECTED",
          message: "Session revoked",
          status: 401,
        },
      });

      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket } = createMockSocket(emitWithAck);

      let caught: ZephyrError | undefined;
      try {
        await strategy.refresh(socket);
      } catch (err) {
        caught = err as ZephyrError;
      }

      expect(caught).toBeInstanceOf(ZephyrError);
      expect(caught?.message).toBe("Session revoked");
      expect(caught?.code).toBe("AUTH_REFRESH_REJECTED");
      expect(caught?.status).toBe(401);
    });

    it("should throw ZEPHYR_AUTH_REFRESH_TIMEOUT when emitWithAck rejects", async () => {
      fetchSpy.mockResolvedValue(createResponse({ ok: true }));
      const emitWithAck = vi.fn().mockRejectedValue(new Error("operation has timed out"));

      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket } = createMockSocket(emitWithAck);

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        name: "ZephyrError",
        code: "ZEPHYR_AUTH_REFRESH_TIMEOUT",
      });
    });

    it("should throw ZEPHYR_AUTH_REFRESH_INVALID_ACK when ack is not a pylon envelope", async () => {
      fetchSpy.mockResolvedValue(createResponse({ ok: true }));
      const emitWithAck = vi.fn().mockResolvedValue({ raw: "data" });

      const strategy = createCookieAuthStrategy({
        refreshUrl: "https://example.test/auth/refresh",
      });
      const { socket } = createMockSocket(emitWithAck);

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_ACK",
      });
    });
  });
});
