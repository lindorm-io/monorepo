import { AegisError } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonSocketAuth } from "../../../types";
import { createSessionRefreshHandler } from "./create-session-refresh-handler";

describe("createSessionRefreshHandler", () => {
  let aegis: any;
  let auth: PylonSocketAuth;
  let socket: any;
  const parsedExp = new Date("2026-04-12T12:00:00.000Z");

  beforeEach(() => {
    aegis = {
      verify: jest.fn().mockResolvedValue({
        payload: { subject: "alice", expiresAt: parsedExp },
        header: { baseFormat: "JWT" },
        token: "new-session-jwt",
      }),
    };

    auth = {
      strategy: "session",
      getExpiresAt: () => new Date("2026-04-11T12:05:00.000Z"),
      refresh: async () => {},
      authExpiredEmittedAt: new Date("2026-04-11T12:04:30.000Z"),
    };

    socket = {
      data: {
        tokens: {},
        session: null,
        pylon: { auth },
      },
    };
  });

  test("updates session, tokens, and auth state on successful lookup", async () => {
    const futureSession = {
      id: "sess-1",
      accessToken: "new-session-jwt",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      issuedAt: new Date(),
      scope: ["openid"],
      subject: "alice",
    } as any;

    const handler = createSessionRefreshHandler({
      aegis,
      lookup: async () => futureSession,
      sessionId: "sess-1",
      socket,
    });

    await handler({});

    expect(socket.data.session).toBe(futureSession);
    expect(socket.data.tokens.bearer).toMatchSnapshot();
    expect(auth.getExpiresAt()).toMatchSnapshot();
    expect(auth.authExpiredEmittedAt).toBeNull();
  });

  test("falls back to session.expiresAt when token is unreadable", async () => {
    aegis.verify.mockRejectedValue(new AegisError("bad token"));

    const futureSession = {
      id: "sess-1",
      accessToken: "bad-token",
      expiresAt: new Date("2099-06-01T00:00:00.000Z"),
      issuedAt: new Date(),
      scope: ["openid"],
      subject: "alice",
    } as any;

    const handler = createSessionRefreshHandler({
      aegis,
      lookup: async () => futureSession,
      sessionId: "sess-1",
      socket,
    });

    await handler({});

    expect(socket.data.session).toBe(futureSession);
    expect(socket.data.tokens.bearer).toBeUndefined();
    expect(auth.getExpiresAt()).toEqual(new Date("2099-06-01T00:00:00.000Z"));
    expect(auth.authExpiredEmittedAt).toBeNull();
  });

  test("throws when lookup returns null", async () => {
    const handler = createSessionRefreshHandler({
      aegis,
      lookup: async () => null,
      sessionId: "sess-1",
      socket,
    });

    await expect(handler({})).rejects.toThrow(ClientError);
  });

  test("throws when session is past expiry", async () => {
    const pastSession = {
      id: "sess-1",
      accessToken: "new-session-jwt",
      expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      issuedAt: new Date(),
      scope: ["openid"],
      subject: "alice",
    } as any;

    const handler = createSessionRefreshHandler({
      aegis,
      lookup: async () => pastSession,
      sessionId: "sess-1",
      socket,
    });

    await expect(handler({})).rejects.toThrow(ClientError);
  });
});
