import type { Socket } from "socket.io-client";
import { ZephyrError } from "../errors/ZephyrError";
import { createBearerAuthStrategy } from "./bearer-auth-strategy";

const createMockSocket = (
  emitWithAck: jest.Mock,
): { socket: Socket; timeout: jest.Mock } => {
  const timeout = jest.fn().mockReturnValue({ emitWithAck });
  const socket = {
    auth: undefined as unknown,
    timeout,
  } as unknown as Socket;
  return { socket, timeout };
};

describe("createBearerAuthStrategy", () => {
  describe("prepareHandshake", () => {
    it("should resolve getAccessToken and set socket.auth.bearer", async () => {
      const getAccessToken = jest.fn().mockResolvedValue("token-123");
      const getExpiresIn = jest.fn();

      const strategy = createBearerAuthStrategy({ getAccessToken, getExpiresIn });
      const { socket } = createMockSocket(jest.fn());

      await strategy.prepareHandshake(socket);

      expect(getAccessToken).toHaveBeenCalledTimes(1);
      expect(getExpiresIn).not.toHaveBeenCalled();
      expect(socket.auth).toEqual({ bearer: "token-123" });
    });

    it("should accept a synchronous getAccessToken", async () => {
      const strategy = createBearerAuthStrategy({
        getAccessToken: () => "sync-token",
        getExpiresIn: () => 60,
      });
      const { socket } = createMockSocket(jest.fn());

      await strategy.prepareHandshake(socket);

      expect(socket.auth).toEqual({ bearer: "sync-token" });
    });
  });

  describe("refresh", () => {
    it("should emit refresh event with bearer and expiresIn and resolve on ok ack", async () => {
      const emitWithAck = jest.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createBearerAuthStrategy({
        getAccessToken: async () => "fresh-token",
        getExpiresIn: async () => 300,
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
      const emitWithAck = jest.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createBearerAuthStrategy({
        getAccessToken: async () => "t",
        getExpiresIn: async () => 60,
        refreshAckTimeoutMs: 2500,
      });

      const { socket, timeout } = createMockSocket(emitWithAck);

      await strategy.refresh(socket);

      expect(timeout).toHaveBeenCalledWith(2500);
    });

    it("should await getAccessToken and getExpiresIn in parallel", async () => {
      const order: Array<string> = [];

      const strategy = createBearerAuthStrategy({
        getAccessToken: async () => {
          order.push("token-start");
          await new Promise((r) => setTimeout(r, 10));
          order.push("token-end");
          return "t";
        },
        getExpiresIn: async () => {
          order.push("expires-start");
          await new Promise((r) => setTimeout(r, 10));
          order.push("expires-end");
          return 60;
        },
      });

      const { socket } = createMockSocket(
        jest.fn().mockResolvedValue({ __pylon: true, ok: true }),
      );

      await strategy.refresh(socket);

      expect(order).toMatchSnapshot();
    });

    it("should throw when ack is { ok: false } and preserve error envelope fields", async () => {
      const emitWithAck = jest.fn().mockResolvedValue({
        __pylon: true,
        ok: false,
        error: {
          code: "AUTH_REFRESH_REJECTED",
          message: "Refresh token expired",
          status: 401,
        },
      });

      const strategy = createBearerAuthStrategy({
        getAccessToken: async () => "t",
        getExpiresIn: async () => 60,
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
      const emitWithAck = jest
        .fn()
        .mockRejectedValue(new Error("operation has timed out"));

      const strategy = createBearerAuthStrategy({
        getAccessToken: async () => "t",
        getExpiresIn: async () => 60,
      });

      const { socket } = createMockSocket(emitWithAck);

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        name: "ZephyrError",
        code: "ZEPHYR_AUTH_REFRESH_TIMEOUT",
      });
    });

    it("should throw when expiresIn is zero", async () => {
      const strategy = createBearerAuthStrategy({
        getAccessToken: async () => "t",
        getExpiresIn: async () => 0,
      });

      const { socket } = createMockSocket(jest.fn());

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_EXPIRES_IN",
      });
    });

    it("should throw when expiresIn is negative", async () => {
      const strategy = createBearerAuthStrategy({
        getAccessToken: async () => "t",
        getExpiresIn: async () => -10,
      });

      const { socket } = createMockSocket(jest.fn());

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_EXPIRES_IN",
      });
    });

    it("should throw when ack shape is not a pylon envelope", async () => {
      const emitWithAck = jest.fn().mockResolvedValue({ raw: "data" });

      const strategy = createBearerAuthStrategy({
        getAccessToken: async () => "t",
        getExpiresIn: async () => 60,
      });

      const { socket } = createMockSocket(emitWithAck);

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_ACK",
      });
    });
  });
});
