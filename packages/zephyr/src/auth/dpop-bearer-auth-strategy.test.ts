import type { Socket } from "socket.io-client";
import { ZephyrError } from "../errors/ZephyrError";
import { createDpopBearerAuthStrategy } from "./dpop-bearer-auth-strategy";
import { beforeAll, describe, expect, it, vi, type Mock } from "vitest";

type MockManager = {
  uri: string;
  opts: { path?: string; extraHeaders?: Record<string, string> };
};

type MockSocket = {
  socket: Socket;
  manager: MockManager;
  timeout: Mock;
};

const createMockSocket = (
  emitWithAck: Mock,
  {
    uri = "https://api.example.com",
    path,
    extraHeaders,
  }: { uri?: string; path?: string; extraHeaders?: Record<string, string> } = {},
): MockSocket => {
  const timeout = vi.fn().mockReturnValue({ emitWithAck });
  const manager: MockManager = { uri, opts: { path, extraHeaders } };
  const socket = {
    auth: undefined as unknown,
    timeout,
    io: manager,
  } as unknown as Socket;
  return { socket, manager, timeout };
};

const decodePart = (part: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(part, "base64url").toString("utf-8"));

describe("createDpopBearerAuthStrategy", () => {
  let keyPair: CryptoKeyPair;
  let publicJwk: JsonWebKey;

  beforeAll(async () => {
    keyPair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  });

  describe("prepareHandshake", () => {
    it("should set socket.auth.bearer from the credentials getter", async () => {
      const getBearerCredentials = vi
        .fn()
        .mockResolvedValue({ bearer: "token-123", expiresIn: 300 });

      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials,
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket } = createMockSocket(vi.fn());

      await strategy.prepareHandshake(socket);

      expect(getBearerCredentials).toHaveBeenCalledTimes(1);
      expect(socket.auth).toEqual({ bearer: "token-123" });
    });

    it("should inject a DPoP proof into io.opts.extraHeaders", async () => {
      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "token-123", expiresIn: 300 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket, manager } = createMockSocket(vi.fn());

      await strategy.prepareHandshake(socket);

      const proof = manager.opts.extraHeaders?.DPoP;
      expect(proof).toBeDefined();

      const parts = (proof as string).split(".");
      expect(parts).toHaveLength(3);

      const header = decodePart(parts[0]);
      expect(header).toMatchObject({ alg: "ES256", typ: "dpop+jwt" });
      expect(header.jwk).not.toHaveProperty("d");

      const payload = decodePart(parts[1]);
      expect(payload).toMatchObject({
        htm: "GET",
        htu: "https://api.example.com/socket.io/",
      });
      expect(payload).toHaveProperty("ath");
      expect(payload).toHaveProperty("jti");
      expect(payload).toHaveProperty("iat");
    });

    it("should preserve existing extraHeaders when injecting DPoP", async () => {
      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "token-123", expiresIn: 300 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket, manager } = createMockSocket(vi.fn(), {
        extraHeaders: { "x-trace-id": "abc-123" },
      });

      await strategy.prepareHandshake(socket);

      expect(manager.opts.extraHeaders).toMatchObject({
        "x-trace-id": "abc-123",
        DPoP: expect.any(String),
      });
    });

    it("should include the access token hash (ath claim) bound to the bearer", async () => {
      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "token-abc", expiresIn: 300 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket, manager } = createMockSocket(vi.fn());

      await strategy.prepareHandshake(socket);

      const proof = manager.opts.extraHeaders?.DPoP as string;
      const payload = decodePart(proof.split(".")[1]);

      // sha256(token-abc) base64url
      const expectedAth = Buffer.from(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode("token-abc") as BufferSource,
        ),
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      expect(payload.ath).toBe(expectedAth);
    });

    it("should target the custom socket.io path when configured", async () => {
      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 300 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket, manager } = createMockSocket(vi.fn(), { path: "/ws" });

      await strategy.prepareHandshake(socket);

      const proof = manager.opts.extraHeaders?.DPoP as string;
      const payload = decodePart(proof.split(".")[1]);

      expect(payload.htu).toBe("https://api.example.com/ws/");
    });
  });

  describe("refresh", () => {
    it("should emit refresh with bearer and expiresIn and no DPoP payload", async () => {
      const emitWithAck = vi.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "fresh", expiresIn: 300 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket, timeout } = createMockSocket(emitWithAck);

      await strategy.refresh(socket);

      expect(timeout).toHaveBeenCalledWith(5000);
      expect(emitWithAck).toHaveBeenCalledWith("$pylon/auth/refresh", {
        bearer: "fresh",
        expiresIn: 300,
      });
    });

    it("should honour a custom refreshAckTimeoutMs", async () => {
      const emitWithAck = vi.fn().mockResolvedValue({ __pylon: true, ok: true });

      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 60 }),
        privateKey: keyPair.privateKey,
        publicJwk,
        refreshAckTimeoutMs: 2500,
      });

      const { socket, timeout } = createMockSocket(emitWithAck);

      await strategy.refresh(socket);

      expect(timeout).toHaveBeenCalledWith(2500);
    });

    it("should throw when ack is { ok: false } with error envelope", async () => {
      const emitWithAck = vi.fn().mockResolvedValue({
        __pylon: true,
        ok: false,
        error: {
          code: "AUTH_REFRESH_REJECTED",
          message: "jkt changed",
          status: 401,
        },
      });

      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 60 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket } = createMockSocket(emitWithAck);

      let caught: ZephyrError | undefined;
      try {
        await strategy.refresh(socket);
      } catch (err) {
        caught = err as ZephyrError;
      }

      expect(caught).toBeInstanceOf(ZephyrError);
      expect(caught?.message).toBe("jkt changed");
      expect(caught?.code).toBe("AUTH_REFRESH_REJECTED");
      expect(caught?.status).toBe(401);
    });

    it("should throw a timeout error when emitWithAck rejects", async () => {
      const emitWithAck = vi.fn().mockRejectedValue(new Error("operation has timed out"));

      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 60 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket } = createMockSocket(emitWithAck);

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        name: "ZephyrError",
        code: "ZEPHYR_AUTH_REFRESH_TIMEOUT",
      });
    });

    it("should throw when expiresIn is not positive", async () => {
      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 0 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket } = createMockSocket(vi.fn());

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_EXPIRES_IN",
      });
    });

    it("should throw when ack shape is not a pylon envelope", async () => {
      const emitWithAck = vi.fn().mockResolvedValue({ raw: "data" });

      const strategy = createDpopBearerAuthStrategy({
        getBearerCredentials: async () => ({ bearer: "t", expiresIn: 60 }),
        privateKey: keyPair.privateKey,
        publicJwk,
      });

      const { socket } = createMockSocket(emitWithAck);

      await expect(strategy.refresh(socket)).rejects.toMatchObject({
        code: "ZEPHYR_AUTH_REFRESH_INVALID_ACK",
      });
    });
  });
});
