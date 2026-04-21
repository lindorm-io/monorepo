import type { Socket } from "socket.io-client";
import { ZephyrError } from "../errors/ZephyrError";
import { createBearerAuthStrategy } from "./bearer-auth-strategy";
import { describe, expect, it, vi, type Mock } from "vitest";

const createMockSocket = (emitWithAck: Mock): { socket: Socket; timeout: Mock } => {
  const timeout = vi.fn().mockReturnValue({ emitWithAck });
  const socket = {
    auth: undefined as unknown,
    timeout,
  } as unknown as Socket;
  return { socket, timeout };
};

describe("createBearerAuthStrategy", () => {
  describe("prepareHandshake", () => {
    it("should resolve getBearerCredentials and set socket.auth.bearer", async () => {
      const getBearerCredentials = vi
        .fn()
        .mockResolvedValue({ bearer: "token-123", expiresIn: 300 });

      const strategy = createBearerAuthStrategy({ getBearerCredentials });
      const { socket } = createMockSocket(vi.fn());

      await strategy.prepareHandshake(socket);

      expect(getBearerCredentials).toHaveBeenCalledTimes(1);
      expect(socket.auth).toEqual({ bearer: "token-123" });
    });

    it("should accept a synchronous getBearerCredentials", async () => {
      const strategy = createBearerAuthStrategy({
        getBearerCredentials: () => ({ bearer: "sync-token", expiresIn: 60 }),
      });
      const { socket } = createMockSocket(vi.fn());

      await strategy.prepareHandshake(socket);

      expect(socket.auth).toEqual({ bearer: "sync-token" });
    });
  });

  describe("refresh", () => {
    it("should emit refresh event with bearer and expiresIn and resolve on ok ack", async () => {
      const emitWithAck = vi.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "fresh-token", expiresIn: 300 }),
      });

      const { socket, timeout } = createMockSocket(emitWithAck);

      await strategy.refresh(socket);

      expect(timeout).toHaveBeenCalledWith(5000);
      expect(emitWithAck).toHaveBeenCalledWith("$pylon/auth/refresh", {
        bearer: "fresh-token",
        expiresIn: 300,
      });
    });

    it("should honour custom refreshAckTimeoutMs", async () => {
      const emitWithAck = vi.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 60 }),
        refreshAckTimeoutMs: 2500,
      });

      const { socket, timeout } = createMockSocket(emitWithAck);

      await strategy.refresh(socket);

      expect(timeout).toHaveBeenCalledWith(2500);
    });

    it("should read bearer and expiresIn from a single getter call", async () => {
      const getBearerCredentials = vi
        .fn()
        .mockResolvedValue({ bearer: "t", expiresIn: 60 });

      const strategy = createBearerAuthStrategy({ getBearerCredentials });

      const { socket } = createMockSocket(
        vi.fn().mockResolvedValue({ __pylon: true, ok: true }),
      );

      await strategy.refresh(socket);

      expect(getBearerCredentials).toHaveBeenCalledTimes(1);
    });

    it("should throw when ack is { ok: false } and preserve error envelope fields", async () => {
      const emitWithAck = vi.fn().mockResolvedValue({
        __pylon: true,
        ok: false,
        error: {
          code: "AUTH_REFRESH_REJECTED",
          message: "Refresh token expired",
          status: 401,
        },
      });

      const strategy = createBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 60 }),
      });

      const { socket } = createMockSocket(emitWithAck);

      let caught: ZephyrError | undefined;
      try {
        await strategy.refresh(socket);
      } catch (err) {
        caught = err as ZephyrError;
      }

      expect(caught).toBeInstanceOf(ZephyrError);
      expect(caught?.message).toBe("Refresh token expired");
      expect(caught?.code).toBe("AUTH_REFRESH_REJECTED");
      expect(caught?.status).toBe(401);
    });

    it("should throw timeout error when emitWithAck rejects", async () => {
      const emitWithAck = vi.fn().mockRejectedValue(new Error("operation has timed out"));

      const strategy = createBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 60 }),
      });

      const { socket } = createMockSocket(emitWithAck);

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        name: "ZephyrError",
        code: "ZEPHYR_AUTH_REFRESH_TIMEOUT",
      });
    });

    it("should throw when expiresIn is zero", async () => {
      const strategy = createBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 0 }),
      });

      const { socket } = createMockSocket(vi.fn());

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_EXPIRES_IN",
      });
    });

    it("should throw when expiresIn is negative", async () => {
      const strategy = createBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: -10 }),
      });

      const { socket } = createMockSocket(vi.fn());

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_EXPIRES_IN",
      });
    });

    it("should throw when ack shape is not a pylon envelope", async () => {
      const emitWithAck = vi.fn().mockResolvedValue({ raw: "data" });

      const strategy = createBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 60 }),
      });

      const { socket } = createMockSocket(emitWithAck);

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_ACK",
      });
    });
  });
});
