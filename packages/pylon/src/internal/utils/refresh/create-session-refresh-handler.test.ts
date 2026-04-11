import { Aegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonSocketAuth } from "../../../types";
import { createSessionRefreshHandler } from "./create-session-refresh-handler";

jest.mock("@lindorm/aegis", () => ({
  ...jest.requireActual("@lindorm/aegis"),
  Aegis: { parse: jest.fn() },
}));

describe("createSessionRefreshHandler", () => {
  let auth: PylonSocketAuth;
  let socket: any;
  const parsedExp = new Date("2026-04-12T12:00:00.000Z");

  beforeEach(() => {
    (Aegis.parse as jest.Mock).mockReset();
    (Aegis.parse as jest.Mock).mockReturnValue({
      payload: { subject: "alice", expiresAt: parsedExp },
      header: {},
      token: "new-session-jwt",
    });

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

  test("throws when lookup returns null", async () => {
    const handler = createSessionRefreshHandler({
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
      lookup: async () => pastSession,
      sessionId: "sess-1",
      socket,
    });

    await expect(handler({})).rejects.toThrow(ClientError);
  });
});
