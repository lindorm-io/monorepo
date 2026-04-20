import { Amphora, IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { ILogger } from "@lindorm/logger";
import { createBearerAuthStrategy, Zephyr } from "@lindorm/zephyr";
import { join } from "path";
import request from "supertest";
import {
  SOCKET_AUTH_TEST_ISSUER,
  SOCKET_AUTH_TEST_KEY_ID,
} from "../__fixtures__/socket-auth/shared";
import { createHandshakeTokenMiddleware } from "../middleware/common/create-handshake-token-middleware";
import { Pylon } from "./Pylon";

// TODO(Phase 9d): cover deferred socket auth scenarios that depend on
// reconciling fake timers with socket.io's internal timers:
//   - $pylon/auth/expired emission inside expiry warning window
//   - autoRefreshOnExpiry round trip via Zephyr
//   - hard-expiry rejection from createAccessTokenMiddleware (token past exp)
//   - throttle behaviour for repeated $pylon/auth/expired emissions
//   These scenarios were intentionally split out so the bearer happy-path
//   tests below stay deterministic and free of fake-timer plumbing.

describe("socket auth (bearer) e2e", () => {
  let pylon: Pylon;
  let amphora: IAmphora;
  let logger: ILogger;

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

    pylon = new Pylon({
      amphora,
      logger,
      environment: "test",
      routes: join(__dirname, "..", "__fixtures__", "socket-auth", "routes"),
      socket: {
        enabled: true,
        listeners: join(__dirname, "..", "__fixtures__", "socket-auth", "listeners"),
        connectionMiddleware: [
          createHandshakeTokenMiddleware({ issuer: SOCKET_AUTH_TEST_ISSUER }),
        ],
      },
      name: "@lindorm/pylon-socket-auth-bearer-test",
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

  type LoginResponse = {
    bearer: string;
    expiresIn: number;
    subject: string;
  };

  const login = async (subject: string, expiresIn = 3600): Promise<LoginResponse> => {
    const response = await request(pylon.callback)
      .post("/login")
      .send({ subject, expiresIn })
      .expect(200);
    // Pylon snake-cases response bodies — translate back to camelCase here.
    return {
      bearer: response.body.bearer,
      expiresIn: response.body.expires_in,
      subject: response.body.subject,
    };
  };

  const createZephyrFor = (creds: LoginResponse): Zephyr => {
    const getCredentials = async () => ({
      bearer: creds.bearer,
      expiresIn: creds.expiresIn,
    });
    return new Zephyr({
      url: getUrl(),
      auth: createBearerAuthStrategy({ getBearerCredentials: getCredentials }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });
  };

  test("happy connect + authenticated event exchange", async () => {
    const credentials = await login("alice");
    const client = createZephyrFor(credentials);

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

  test("public listener works without authentication state in handler", async () => {
    const credentials = await login("alice");
    const client = createZephyrFor(credentials);

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

  test("refresh happy path: new bearer accepted, socket keeps working", async () => {
    const initial = await login("alice", 3600);
    let current = initial;

    const getCredentials = jest.fn(async () => ({
      bearer: current.bearer,
      expiresIn: current.expiresIn,
    }));

    const client = new Zephyr({
      url: getUrl(),
      auth: createBearerAuthStrategy({ getBearerCredentials: getCredentials }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await client.connect();

      // Mint a fresh token (still subject "alice") and update closure.
      current = await login("alice", 7200);

      await client.refresh();

      const response = await client.request<any>("secure:echo", {
        text: "after-refresh",
      });

      expect(response.authenticated).toBe(true);
      expect(response.subject).toBe("alice");
      expect(response.text).toBe("after-refresh");
      expect(getCredentials).toHaveBeenCalledTimes(2);
    } finally {
      await client.disconnect();
    }
  });

  test("refresh with wrong subject is rejected", async () => {
    const initial = await login("alice", 3600);
    let current = initial;

    const getCredentials = jest.fn(async () => ({
      bearer: current.bearer,
      expiresIn: current.expiresIn,
    }));

    const client = new Zephyr({
      url: getUrl(),
      auth: createBearerAuthStrategy({ getBearerCredentials: getCredentials }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await client.connect();

      // Mint a token for a different subject — pylon must reject the refresh.
      current = await login("bob", 3600);

      await expect(client.refresh()).rejects.toThrow();
    } finally {
      await client.disconnect();
    }
  });

  test("missing handshake token causes connect to be rejected by middleware", async () => {
    const client = new Zephyr({
      url: getUrl(),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await expect(client.connect()).rejects.toThrow();
    } finally {
      await client.disconnect();
    }
  });

  test("refresh ack envelope shape", async () => {
    const initial = await login("alice", 3600);
    let current = initial;

    const getCredentials = jest.fn(async () => ({
      bearer: current.bearer,
      expiresIn: current.expiresIn,
    }));

    const client = new Zephyr({
      url: getUrl(),
      auth: createBearerAuthStrategy({ getBearerCredentials: getCredentials }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await client.connect();

      current = await login("alice", 7200);

      // Reach into the underlying socket and emit the refresh event with ack
      // directly so we can snapshot the wire envelope shape.
      const socket = (client as any).socket;
      const ack = await socket.timeout(5000).emitWithAck("$pylon/auth/refresh", {
        bearer: current.bearer,
        expiresIn: current.expiresIn,
      });

      expect(ack).toMatchSnapshot();
    } finally {
      await client.disconnect();
    }
  });
});
