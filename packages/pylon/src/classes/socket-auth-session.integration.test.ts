import { Amphora, IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger, ILogger } from "@lindorm/logger";
import { createMockProteusSource } from "@lindorm/proteus/mocks";
import { createCookieAuthStrategy, Zephyr } from "@lindorm/zephyr";
import { join } from "path";
import request from "supertest";
import {
  SOCKET_AUTH_TEST_ISSUER,
  SOCKET_AUTH_TEST_KEY_ID,
} from "../__fixtures__/socket-auth/shared";
import { IPylonSession } from "../interfaces";
import { Pylon } from "./Pylon";

/**
 * Cookie-jar strategy: faithful use of `createCookieAuthStrategy` with manual
 * cookie injection on both transports.
 *
 * socket.io-client in Node does not have a cookie jar, and the global `fetch`
 * used by `createCookieAuthStrategy` does not either. Rather than pulling in
 * `tough-cookie`/`fetch-cookie` (heavy machinery for one test suite), we:
 *
 *   1. Hit the HTTP login route via supertest, read `Set-Cookie`, extract the
 *      raw `pylon_session=<encoded-id>` pair.
 *   2. Pass that cookie to Zephyr via `socketOptions.extraHeaders.cookie` so
 *      the socket.io websocket upgrade sends it — this is exactly what a
 *      browser would do with `withCredentials: true`.
 *   3. Pass the same cookie to the refresh strategy via
 *      `refreshFetchInit.headers.cookie` so `fetch(refreshUrl, ...)` inside
 *      the real strategy sees it.
 *
 * Important: we use the "websocket" transport (not "polling") because
 * engine.io's HTTP long-polling transport conflicts with Koa's request
 * handler on the same http.Server — both attempt to write response headers,
 * causing "Cannot write headers after they are sent" errors. The websocket
 * transport avoids this by upgrading to a persistent connection after the
 * initial handshake.
 *
 * The cookie value is base64url-encoded by Pylon's cookie middleware, so
 * `extractSessionCookie` decodes it to recover the raw session UUID for
 * direct store assertions.
 */

const ALLOWED_ORIGIN = "http://allowed.test.lindorm.io";

const buildInMemoryProteus = () => {
  const store = new Map<string, IPylonSession>();

  const repo = {
    upsert: jest.fn(async (session: IPylonSession) => {
      store.set(session.id, { ...session });
      return { ...session };
    }),
    findOne: jest.fn(async (criteria: { id: string }) => {
      const hit = store.get(criteria.id);
      return hit ? { ...hit } : null;
    }),
    delete: jest.fn(async (criteria: { id?: string; subject?: string }) => {
      if (criteria.id) {
        store.delete(criteria.id);
        return;
      }
      if (criteria.subject) {
        for (const [key, value] of store.entries()) {
          if (value.subject === criteria.subject) store.delete(key);
        }
      }
    }),
  } as any;

  const session = {
    repository: jest.fn(() => repo),
    ping: jest.fn().mockResolvedValue(true),
  } as any;

  const source = createMockProteusSource();
  (source.session as jest.Mock).mockImplementation(() => session);

  return { source, store };
};

describe("socket auth (session / cookie) e2e", () => {
  let pylon: Pylon;
  let amphora: IAmphora;
  let logger: ILogger;
  let store: Map<string, IPylonSession>;

  beforeAll(async () => {
    logger = createMockLogger();

    amphora = new Amphora({
      domain: SOCKET_AUTH_TEST_ISSUER,
      logger,
    });

    amphora.add(
      KryptosKit.from.b64({
        id: SOCKET_AUTH_TEST_KEY_ID,
        algorithm: "ES256",
        curve: "P-256",
        privateKey:
          "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcyOxjn7CekTvSkiQvqx5JhFOmwPYFVFHmLKfio6aJ1uhRANCAAQfFaJkGZMxDn656YiDrSJ5sLRwip-y3a0VzC4cUPxxAJzuRBRtVqM3GitfTQEiUrzF2pcmMZbteAOhIqLlU_f6",
        publicKey:
          "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQCc7kQUbVajNxorX00BIlK8xdqXJjGW7XgDoSKi5VP3-g",
        purpose: "token",
        type: "EC",
        use: "sig",
      }),
    );

    const inMemory = buildInMemoryProteus();
    store = inMemory.store;

    pylon = new Pylon({
      amphora,
      logger,
      environment: "test",
      cors: { allowOrigins: [ALLOWED_ORIGIN] },
      session: {
        enabled: true,
        expiry: "90 minutes",
        httpOnly: true,
        sameSite: "lax",
        signed: false,
        proteus: inMemory.source as any,
      },
      routes: join(__dirname, "..", "__fixtures__", "socket-auth", "routes"),
      socket: {
        enabled: true,
        listeners: join(__dirname, "..", "__fixtures__", "socket-auth", "listeners"),
      },
      name: "@lindorm/pylon-socket-auth-session-test",
      port: 0,
      version: "0.0.1",
    });

    await pylon.start();
  });

  afterAll(async () => {
    await pylon.stop();
  });

  const getUrl = (): string => {
    const addr = (pylon as any).server.address();
    return `http://127.0.0.1:${addr.port}`;
  };

  const extractSessionCookie = (
    setCookieHeaders: Array<string>,
  ): { cookiePair: string; sessionId: string } => {
    for (const header of setCookieHeaders) {
      const pair = header.split(";")[0];
      if (pair.startsWith("pylon_session=")) {
        const encoded = pair.slice("pylon_session=".length);
        const decoded = Buffer.from(encoded, "base64url").toString();
        return { cookiePair: pair, sessionId: decoded };
      }
    }
    throw new Error("pylon_session cookie not set on login response");
  };

  type LoginResult = {
    cookie: string;
    sessionId: string;
    subject: string;
  };

  const login = async (subject = "alice", expiresIn = 3600): Promise<LoginResult> => {
    const response = await request(pylon.callback)
      .post("/login-session")
      .send({ subject, expiresIn })
      .expect(200);

    const setCookie = response.get("Set-Cookie") as unknown as Array<string>;
    const { cookiePair, sessionId } = extractSessionCookie(setCookie ?? []);

    return { cookie: cookiePair, sessionId, subject };
  };

  const createZephyrFor = (loginResult: LoginResult): Zephyr =>
    new Zephyr({
      url: getUrl(),
      auth: createCookieAuthStrategy({
        refreshUrl: `${getUrl()}/refresh-session`,
        refreshFetchInit: { headers: { cookie: loginResult.cookie } },
      }),
      socketOptions: {
        transports: ["websocket"],
        forceNew: true,
        extraHeaders: {
          cookie: loginResult.cookie,
          origin: ALLOWED_ORIGIN,
        },
      },
    });

  test("happy connect + authenticated event exchange", async () => {
    const creds = await login("alice");
    const client = createZephyrFor(creds);

    try {
      await client.connect();

      const response = await client.request<any>("secure:echo", { text: "hello" });

      expect(response).toEqual({
        event: "secure:echo",
        text: "hello",
        authenticated: true,
        subject: "alice",
        middlewareChain: ["socket-auth-root", "secure"],
      });
    } finally {
      await client.disconnect();
    }
  });

  test("public listener still works when no cookie is presented", async () => {
    const client = new Zephyr({
      url: getUrl(),
      socketOptions: {
        transports: ["websocket"],
        forceNew: true,
        extraHeaders: { origin: ALLOWED_ORIGIN },
      },
    });

    try {
      await client.connect();

      const response = await client.request<any>("public-echo", { text: "ping" });

      expect(response).toEqual({
        event: "public-echo",
        text: "ping",
        authenticated: false,
      });
    } finally {
      await client.disconnect();
    }
  });

  test("authenticated event fails when no cookie is presented", async () => {
    const client = new Zephyr({
      url: getUrl(),
      socketOptions: {
        transports: ["websocket"],
        forceNew: true,
        extraHeaders: { origin: ALLOWED_ORIGIN },
      },
      timeout: 2000,
    });

    try {
      await client.connect();
      await expect(client.request<any>("secure:echo", { text: "x" })).rejects.toThrow();
    } finally {
      await client.disconnect();
    }
  }, 10_000);

  test("refresh via cookie strategy: HTTP extends store, socket event re-reads", async () => {
    const creds = await login("alice", 3600);
    const client = createZephyrFor(creds);

    try {
      await client.connect();

      const before = store.get(creds.sessionId);
      const beforeExpiresAt = before?.expiresAt?.getTime() ?? 0;

      await client.refresh();

      const after = store.get(creds.sessionId);
      expect(after).toBeDefined();
      expect(after!.expiresAt!.getTime()).toBeGreaterThan(beforeExpiresAt);

      const response = await client.request<any>("secure:echo", {
        text: "after-refresh",
      });

      expect(response.authenticated).toBe(true);
      expect(response.subject).toBe("alice");
      expect(response.text).toBe("after-refresh");
    } finally {
      await client.disconnect();
    }
  });

  test("store-backed refresh detects revocation (session removed mid-connection)", async () => {
    const creds = await login("alice", 3600);
    const client = createZephyrFor(creds);

    try {
      await client.connect();

      // Directly delete the session from the backing store — bypassing HTTP.
      store.delete(creds.sessionId);

      const socket = (client as any).socket;

      // Set up disconnect listener BEFORE triggering the refresh failure.
      const disconnectPromise = new Promise<void>((resolve) => {
        socket.on("disconnect", () => resolve());
      });

      // The socket-level refresh handler re-reads the store and must reject.
      // Note: the cookie strategy would first POST /refresh-session, which
      // would also reject (since ctx.state.session is null). To exercise the
      // _socket_ closure, we emit the refresh event directly.
      const ack = await socket.timeout(5000).emitWithAck("$pylon/auth/refresh", {});

      expect(ack.__pylon).toBe(true);
      expect(ack.ok).toBe(false);

      // Session strategy must disconnect the socket after failed refresh.
      await disconnectPromise;
    } finally {
      await client.disconnect();
    }
  });

  test("store-backed refresh detects past-expiry session reload", async () => {
    const creds = await login("alice", 3600);
    const client = createZephyrFor(creds);

    try {
      await client.connect();

      // Mutate the backing store so the next reload sees an expired session.
      const current = store.get(creds.sessionId)!;
      store.set(creds.sessionId, {
        ...current,
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      });

      const socket = (client as any).socket;

      // Set up disconnect listener BEFORE triggering the refresh failure.
      const disconnectPromise = new Promise<void>((resolve) => {
        socket.on("disconnect", () => resolve());
      });

      const ack = await socket.timeout(5000).emitWithAck("$pylon/auth/refresh", {});

      expect(ack.__pylon).toBe(true);
      expect(ack.ok).toBe(false);

      // Session strategy must disconnect the socket after failed refresh.
      await disconnectPromise;
    } finally {
      await client.disconnect();
    }
  });

  test("CORS rejects disallowed origin at handshake", async () => {
    const creds = await login("alice");
    const client = new Zephyr({
      url: getUrl(),
      socketOptions: {
        transports: ["websocket"],
        forceNew: true,
        extraHeaders: {
          cookie: creds.cookie,
          origin: "http://evil.test.lindorm.io",
        },
      },
    });

    try {
      await expect(client.connect()).rejects.toThrow();
    } finally {
      await client.disconnect();
    }
  });
});

describe("PylonIo constructor enforces CORS safety net when session is enabled", () => {
  let amphora: IAmphora;
  let logger: ILogger;

  beforeAll(() => {
    logger = createMockLogger();
    amphora = new Amphora({
      domain: SOCKET_AUTH_TEST_ISSUER,
      logger,
    });
    amphora.add(
      KryptosKit.from.b64({
        id: SOCKET_AUTH_TEST_KEY_ID,
        algorithm: "ES256",
        curve: "P-256",
        privateKey:
          "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcyOxjn7CekTvSkiQvqx5JhFOmwPYFVFHmLKfio6aJ1uhRANCAAQfFaJkGZMxDn656YiDrSJ5sLRwip-y3a0VzC4cUPxxAJzuRBRtVqM3GitfTQEiUrzF2pcmMZbteAOhIqLlU_f6",
        publicKey:
          "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQCc7kQUbVajNxorX00BIlK8xdqXJjGW7XgDoSKi5VP3-g",
        purpose: "token",
        type: "EC",
        use: "sig",
      }),
    );
  });

  const baseOptions = () => ({
    amphora,
    logger,
    environment: "test" as const,
    session: {
      enabled: true,
      expiry: "90 minutes" as const,
      httpOnly: true,
      sameSite: "lax" as const,
      signed: false,
    },
    routes: join(__dirname, "..", "__fixtures__", "socket-auth", "routes"),
    socket: {
      enabled: true,
      listeners: join(__dirname, "..", "__fixtures__", "socket-auth", "listeners"),
    },
    name: "@lindorm/pylon-socket-auth-session-cors-guard",
    port: 0,
    version: "0.0.1",
  });

  test("throws when session is set without a CORS allowlist", () => {
    expect(() => new Pylon(baseOptions())).toThrow(
      /Session middleware requires an explicit CORS allowlist/i,
    );
  });

  test("throws when session is set with wildcard CORS allowlist", () => {
    expect(
      () =>
        new Pylon({
          ...baseOptions(),
          cors: { allowOrigins: "*" },
        }),
    ).toThrow(/non-wildcard CORS allowlist/i);
  });
});
