import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError } from "@lindorm/errors";
import { PylonSocketAuth } from "../../../types";
import { createBearerRefreshHandler } from "./create-bearer-refresh-handler";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("createBearerRefreshHandler", () => {
  let aegis: ReturnType<typeof createMockAegis>;
  let auth: PylonSocketAuth;
  let socket: any;

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date("2026-04-11T12:00:00.000Z"));

    aegis = createMockAegis();

    auth = {
      strategy: "bearer",
      getExpiresAt: () => new Date("2026-04-11T12:05:00.000Z"),
      refresh: async () => {},
      authExpiredEmittedAt: new Date("2026-04-11T12:04:30.000Z"),
    };

    socket = {
      data: {
        tokens: { bearer: { payload: { subject: "alice" } } },
        pylon: { auth },
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("swaps bearer, updates getExpiresAt from expiresIn, clears authExpiredEmittedAt on valid refresh", async () => {
    (aegis.verify as Mock).mockResolvedValue({
      payload: { subject: "alice", expiresAt: new Date("2026-04-11T13:30:00.000Z") },
      header: { tokenType: "access_token" },
      token: "new-jwt",
    });

    const handler = createBearerRefreshHandler({
      aegis,
      socket,
      subject: "alice",
      verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
    });

    await handler({ bearer: "new-jwt", expiresIn: 3600 });

    expect(socket.data.tokens.bearer).toMatchSnapshot();
    expect(auth.getExpiresAt()).toEqual(new Date("2026-04-11T13:00:00.000Z"));
    expect(auth.authExpiredEmittedAt).toBeNull();
  });

  test("envelope expiresIn wins over parsed token exp", async () => {
    (aegis.verify as Mock).mockResolvedValue({
      payload: { subject: "alice", expiresAt: new Date("2026-04-11T23:59:59.000Z") },
      header: { tokenType: "access_token" },
      token: "new-jwt",
    });

    const handler = createBearerRefreshHandler({
      aegis,
      socket,
      subject: "alice",
      verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
    });

    await handler({ bearer: "new-jwt", expiresIn: 300 });

    expect(auth.getExpiresAt()).toEqual(new Date("2026-04-11T12:05:00.000Z"));
  });

  test("throws when subject changes", async () => {
    (aegis.verify as Mock).mockResolvedValue({
      payload: { subject: "bob", expiresAt: new Date() },
      header: {},
      token: "new-jwt",
    });

    const handler = createBearerRefreshHandler({
      aegis,
      socket,
      subject: "alice",
      verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
    });

    await expect(handler({ bearer: "new-jwt", expiresIn: 3600 })).rejects.toThrow(
      ClientError,
    );
  });

  describe("capturedJkt (DPoP binding)", () => {
    test("accepts refresh when new token has same cnf.jkt", async () => {
      (aegis.verify as Mock).mockResolvedValue({
        payload: {
          subject: "alice",
          expiresAt: new Date("2026-04-11T13:00:00.000Z"),
          confirmation: { thumbprint: "jkt-abc" },
        },
        header: {},
        token: "new-jwt",
      });

      const handler = createBearerRefreshHandler({
        aegis,
        capturedJkt: "jkt-abc",
        socket,
        subject: "alice",
        verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
      });

      await expect(
        handler({ bearer: "new-jwt", expiresIn: 3600 }),
      ).resolves.toBeUndefined();
      expect(socket.data.tokens.bearer).toMatchSnapshot();
    });

    test("rejects refresh when new token has a different cnf.jkt", async () => {
      (aegis.verify as Mock).mockResolvedValue({
        payload: {
          subject: "alice",
          expiresAt: new Date(),
          confirmation: { thumbprint: "jkt-xyz" },
        },
        header: {},
        token: "new-jwt",
      });

      const handler = createBearerRefreshHandler({
        aegis,
        capturedJkt: "jkt-abc",
        socket,
        subject: "alice",
        verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
      });

      await expect(handler({ bearer: "new-jwt", expiresIn: 3600 })).rejects.toThrow(
        ClientError,
      );
    });

    test("rejects refresh when new token is bearer-only (no cnf.jkt)", async () => {
      (aegis.verify as Mock).mockResolvedValue({
        payload: { subject: "alice", expiresAt: new Date() },
        header: {},
        token: "new-jwt",
      });

      const handler = createBearerRefreshHandler({
        aegis,
        capturedJkt: "jkt-abc",
        socket,
        subject: "alice",
        verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
      });

      await expect(handler({ bearer: "new-jwt", expiresIn: 3600 })).rejects.toThrow(
        ClientError,
      );
    });
  });

  test("throws when payload is malformed", async () => {
    const handler = createBearerRefreshHandler({
      aegis,
      socket,
      subject: "alice",
      verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
    });

    await expect(handler({})).rejects.toThrow(ClientError);
    await expect(handler(null)).rejects.toThrow(ClientError);
    await expect(handler({ bearer: 123, expiresIn: 3600 })).rejects.toThrow(ClientError);
    await expect(handler({ bearer: "new-jwt" })).rejects.toThrow(ClientError);
    await expect(handler({ bearer: "new-jwt", expiresIn: "3600" })).rejects.toThrow(
      ClientError,
    );
    await expect(handler({ bearer: "new-jwt", expiresIn: 0 })).rejects.toThrow(
      ClientError,
    );
    await expect(handler({ bearer: "new-jwt", expiresIn: -1 })).rejects.toThrow(
      ClientError,
    );
  });
});
