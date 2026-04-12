import { Aegis, IAegis } from "@lindorm/aegis";
import { Amphora, IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger, ILogger } from "@lindorm/logger";
import {
  createBearerAuthStrategy,
  createDpopBearerAuthStrategy,
  Zephyr,
} from "@lindorm/zephyr";
import { webcrypto } from "crypto";
import { join } from "path";
import type { Socket } from "socket.io-client";
import request from "supertest";
import { mintTestAccessToken } from "../__fixtures__/socket-auth/mint-test-access-token";
import {
  SOCKET_AUTH_TEST_ISSUER,
  SOCKET_AUTH_TEST_KEY_ID,
} from "../__fixtures__/socket-auth/shared";
import { reconstructHandshakeHtu } from "../internal/utils/handshake/reconstruct-handshake-htu";
import { createHandshakeTokenMiddleware } from "../middleware/common/create-handshake-token-middleware";
import { Pylon } from "./Pylon";

// Phase 9b — DPoP end-to-end integration tests. Phase 9c (session/cookie) runs
// in parallel and owns socket-auth-session.integration.test.ts. Phase 9d covers
// the fake-timer-dependent expiry scenarios and is intentionally deferred.

// ---------------------------------------------------------------------------
// Local copies of zephyr's sign-dpop-proof and resolve-handshake-htu. Zephyr
// does not re-export these from its public surface, and crossing package
// boundaries via relative source imports would couple the test to zephyr's
// internal layout. Inlining keeps the test hermetic. Any drift here vs.
// zephyr's real implementations would show up as a handshake rejection on the
// happy-path test — that is the whole point of Phase 9b as a contract check.
// ---------------------------------------------------------------------------

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const stringToBase64Url = (value: string): string =>
  bytesToBase64Url(new TextEncoder().encode(value));

const sha256Base64Url = async (value: string): Promise<string> => {
  const digest = await webcrypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(digest));
};

type Jwk = Record<string, unknown>;

const toPublicJwk = (jwk: Jwk): Jwk => {
  const { kty, crv, x, y } = jwk;
  return { kty, crv, x, y };
};

type LocalSignDpopProofOptions = {
  privateKey: CryptoKey;
  publicJwk: Jwk;
  htm: string;
  htu: string;
  accessToken?: string;
};

const signLocalDpopProof = async (
  options: LocalSignDpopProofOptions,
): Promise<string> => {
  const header = {
    alg: "ES256",
    typ: "dpop+jwt",
    jwk: toPublicJwk(options.publicJwk),
  };

  const payload: Record<string, unknown> = {
    jti: webcrypto.randomUUID(),
    htm: options.htm,
    htu: options.htu,
    iat: Math.floor(Date.now() / 1000),
  };

  if (options.accessToken) {
    payload.ath = await sha256Base64Url(options.accessToken);
  }

  const headerB64 = stringToBase64Url(JSON.stringify(header));
  const payloadB64 = stringToBase64Url(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    options.privateKey,
    signingInput,
  );

  const signatureB64 = bytesToBase64Url(new Uint8Array(signature));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
};

const DEFAULT_SOCKET_IO_PATH = "/socket.io";

const wsToHttpProtocol = (protocol: string): string => {
  const lower = protocol.toLowerCase();
  if (lower === "wss:") return "https:";
  if (lower === "ws:") return "http:";
  return lower;
};

const normalizeSocketIoPath = (path: string): string => {
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  return `${withLeading.replace(/\/$/, "")}/`;
};

const stripQuery = (value: string): string => {
  const q = value.indexOf("?");
  return q === -1 ? value : value.slice(0, q);
};

const normalizeHtu = (origin: string, path: string): string => {
  const url = new URL(`${origin}${path}`);
  return `${url.protocol}//${url.host}${url.pathname}`;
};

const resolveLocalHandshakeHtu = (socket: Socket): string => {
  const manager = (
    socket as unknown as { io: { uri?: string; opts?: { path?: string } } }
  ).io;
  const rawUri = manager.uri;
  if (typeof rawUri !== "string" || rawUri.length === 0) {
    throw new Error("Unable to resolve DPoP htu: socket.io manager has no uri");
  }
  const parsed = new URL(rawUri);
  const protocol = wsToHttpProtocol(parsed.protocol);
  const origin = `${protocol}//${parsed.host}`;
  const rawPath = manager.opts?.path ?? DEFAULT_SOCKET_IO_PATH;
  const path = normalizeSocketIoPath(stripQuery(rawPath));
  return normalizeHtu(origin, path);
};

// ---------------------------------------------------------------------------

describe("socket auth (dpop-bearer) e2e", () => {
  let pylon: Pylon;
  let amphora: IAmphora;
  let aegis: IAegis;
  let logger: ILogger;
  let privateKey: CryptoKey;
  let publicJwk: Jwk;
  let clientJkt: string;

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

    aegis = new Aegis({ amphora, logger });

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
      name: "@lindorm/pylon-socket-auth-dpop-test",
      port: 0,
      version: "0.0.1",
    });

    await pylon.start();

    const pair = (await webcrypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    )) as { privateKey: CryptoKey; publicKey: CryptoKey };
    privateKey = pair.privateKey;
    const rawJwk = (await webcrypto.subtle.exportKey("jwk", pair.publicKey)) as Jwk;
    publicJwk = { ...rawJwk, alg: "ES256", use: "sig" };
    clientJkt = KryptosKit.from.jwk({
      ...toPublicJwk(publicJwk),
      alg: "ES256",
      use: "sig",
    } as any).thumbprint;
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
    jkt?: string;
  };

  const loginBearer = async (
    subject: string,
    expiresIn = 3600,
  ): Promise<LoginResponse> => {
    const response = await request(pylon.callback)
      .post("/login")
      .send({ subject, expiresIn })
      .expect(200);
    return {
      bearer: response.body.bearer,
      expiresIn: response.body.expires_in,
      subject: response.body.subject,
    };
  };

  const loginDpop = async (subject: string, expiresIn = 3600): Promise<LoginResponse> => {
    const loginUrl = `${getUrl()}/login-dpop`;
    const proof = await signLocalDpopProof({
      privateKey,
      publicJwk,
      htm: "POST",
      htu: loginUrl,
    });
    const response = await request(pylon.callback)
      .post("/login-dpop")
      .set("DPoP", proof)
      .send({ subject, expiresIn })
      .expect(200);
    return {
      bearer: response.body.bearer,
      expiresIn: response.body.expires_in,
      subject: response.body.subject,
      jkt: response.body.jkt,
    };
  };

  const createDpopZephyrFor = (creds: LoginResponse): Zephyr => {
    const getCredentials = async () => ({
      bearer: creds.bearer,
      expiresIn: creds.expiresIn,
    });
    return new Zephyr({
      url: getUrl(),
      auth: createDpopBearerAuthStrategy({
        getBearerCredentials: getCredentials,
        privateKey,
        publicJwk,
      }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });
  };

  test("happy connect + authenticated event exchange", async () => {
    const credentials = await loginDpop("alice");
    expect(credentials.jkt).toBe(clientJkt);

    const client = createDpopZephyrFor(credentials);

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

  test("happy-path htu matches end-to-end (sentinel)", async () => {
    const credentials = await loginDpop("alice");

    let capturedClientHtu: string | undefined;

    const client = new Zephyr({
      url: getUrl(),
      auth: {
        prepareHandshake: async (socket: any) => {
          socket.auth = { bearer: credentials.bearer };
          const htu = resolveLocalHandshakeHtu(socket);
          capturedClientHtu = htu;
          const proof = await signLocalDpopProof({
            privateKey,
            publicJwk,
            htm: "GET",
            htu,
            accessToken: credentials.bearer,
          });
          const manager = (socket as any).io;
          manager.opts = manager.opts ?? {};
          manager.opts.extraHeaders = {
            ...(manager.opts.extraHeaders ?? {}),
            DPoP: proof,
          };
        },
        refresh: async () => {},
      },
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await client.connect();

      const ioServer: any = (pylon as any).io?.server;
      const sockets = ioServer?.sockets?.sockets;
      const serverSocket: any = sockets ? Array.from(sockets.values()).pop() : undefined;
      const serverHtu = serverSocket
        ? reconstructHandshakeHtu(serverSocket.handshake)
        : undefined;
      const serverHtuString = serverHtu
        ? `${serverHtu.origin}${serverHtu.path}`
        : undefined;

      // Surface both htu strings via the mock logger so the test output
      // captures them for the landing report.
      logger.info("dpop-phase9b htu compare", {
        clientSigningHtu: capturedClientHtu,
        serverReconstructedHtu: serverHtuString,
      });
      // Also write to stderr so the live jest output carries the values —
      // mock logger is captured but jest doesn't print it by default.
      process.stderr.write(
        `\n[phase9b-htu] client=${capturedClientHtu} server=${serverHtuString}\n`,
      );

      expect(capturedClientHtu).toBeDefined();
      expect(serverHtuString).toBeDefined();
      expect(capturedClientHtu).toBe(serverHtuString);
    } finally {
      await client.disconnect();
    }
  });

  test("handshake with wrong htu is rejected", async () => {
    const credentials = await loginDpop("alice");

    const client = new Zephyr({
      url: getUrl(),
      auth: {
        prepareHandshake: async (socket: any) => {
          socket.auth = { bearer: credentials.bearer };
          const proof = await signLocalDpopProof({
            privateKey,
            publicJwk,
            htm: "GET",
            htu: "https://wrong.example.com/socket.io/",
            accessToken: credentials.bearer,
          });
          const manager = (socket as any).io;
          manager.opts = manager.opts ?? {};
          manager.opts.extraHeaders = {
            ...(manager.opts.extraHeaders ?? {}),
            DPoP: proof,
          };
        },
        refresh: async () => {},
      },
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await expect(client.connect()).rejects.toThrow();
    } finally {
      await client.disconnect();
    }
  });

  test("jkt-bound token without DPoP proof is rejected", async () => {
    const credentials = await loginDpop("alice");

    const getCredentials = async () => ({
      bearer: credentials.bearer,
      expiresIn: credentials.expiresIn,
    });
    const client = new Zephyr({
      url: getUrl(),
      auth: createBearerAuthStrategy({ getBearerCredentials: getCredentials }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await expect(client.connect()).rejects.toThrow();
    } finally {
      await client.disconnect();
    }
  });

  test("optional mode: bearer-only token with signed DPoP proof is accepted", async () => {
    const credentials = await loginBearer("alice");

    const client = createDpopZephyrFor(credentials);

    try {
      await client.connect();

      const response = await client.request<any>("secure:echo", { text: "hi" });

      expect(response.authenticated).toBe(true);
      expect(response.subject).toBe("alice");
    } finally {
      await client.disconnect();
    }
  });

  test("required mode: bearer-only token is rejected even with signed proof", async () => {
    const strictPylon = new Pylon({
      amphora,
      logger,
      environment: "test",
      routes: join(__dirname, "..", "__fixtures__", "socket-auth", "routes"),
      socket: {
        enabled: true,
        listeners: join(__dirname, "..", "__fixtures__", "socket-auth", "listeners"),
        connectionMiddleware: [
          createHandshakeTokenMiddleware({
            issuer: SOCKET_AUTH_TEST_ISSUER,
            dpop: "required",
          }),
        ],
      },
      name: "@lindorm/pylon-socket-auth-dpop-required-test",
      port: 0,
      version: "0.0.1",
    });
    await strictPylon.start();

    try {
      const strictAddr = (strictPylon as any).server.address();
      const strictUrl = `http://127.0.0.1:${strictAddr.port}`;

      const response = await request(strictPylon.callback)
        .post("/login")
        .send({ subject: "alice", expiresIn: 3600 })
        .expect(200);
      const credentials: LoginResponse = {
        bearer: response.body.bearer,
        expiresIn: response.body.expires_in,
        subject: response.body.subject,
      };

      const getCredentials = async () => ({
        bearer: credentials.bearer,
        expiresIn: credentials.expiresIn,
      });

      const client = new Zephyr({
        url: strictUrl,
        auth: createDpopBearerAuthStrategy({
          getBearerCredentials: getCredentials,
          privateKey,
          publicJwk,
        }),
        socketOptions: { transports: ["websocket"], forceNew: true },
      });

      try {
        await expect(client.connect()).rejects.toThrow();
      } finally {
        await client.disconnect();
      }
    } finally {
      await strictPylon.stop();
    }
  });

  test("refresh happy path: same cnf.jkt accepted, socket keeps working", async () => {
    const initial = await loginDpop("alice", 3600);
    let current = initial;

    const getCredentials = jest.fn(async () => ({
      bearer: current.bearer,
      expiresIn: current.expiresIn,
    }));

    const client = new Zephyr({
      url: getUrl(),
      auth: createDpopBearerAuthStrategy({
        getBearerCredentials: getCredentials,
        privateKey,
        publicJwk,
      }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await client.connect();

      current = await loginDpop("alice", 7200);

      await client.refresh();

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

  test("refresh with different cnf.jkt is rejected", async () => {
    const initial = await loginDpop("alice", 3600);

    // Mint a token bound to a rotated jkt using the helper directly.
    const rotatedJkt = `${clientJkt}-rotated`;
    const rotatedMint = await mintTestAccessToken(aegis, {
      subject: "alice",
      expiresIn: 3600,
      jkt: rotatedJkt,
    });
    const rotated: LoginResponse = {
      bearer: rotatedMint.token,
      expiresIn: rotatedMint.expiresIn,
      subject: "alice",
    };

    let current = initial;

    const getCredentials = jest.fn(async () => ({
      bearer: current.bearer,
      expiresIn: current.expiresIn,
    }));

    const client = new Zephyr({
      url: getUrl(),
      auth: createDpopBearerAuthStrategy({
        getBearerCredentials: getCredentials,
        privateKey,
        publicJwk,
      }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await client.connect();

      current = rotated;

      await expect(client.refresh()).rejects.toThrow();
    } finally {
      await client.disconnect();
    }
  });

  test("refresh event emit carries no DPoP header on the payload", async () => {
    const initial = await loginDpop("alice", 3600);
    let current = initial;

    const getCredentials = jest.fn(async () => ({
      bearer: current.bearer,
      expiresIn: current.expiresIn,
    }));

    const client = new Zephyr({
      url: getUrl(),
      auth: createDpopBearerAuthStrategy({
        getBearerCredentials: getCredentials,
        privateKey,
        publicJwk,
      }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await client.connect();

      current = await loginDpop("alice", 7200);

      const socket = (client as any).socket;
      const emitSpy = jest.spyOn(socket, "emitWithAck");

      await client.refresh();

      const refreshCalls = emitSpy.mock.calls.filter(
        (call) => call[0] === "$pylon/auth/refresh",
      );
      expect(refreshCalls.length).toBeGreaterThan(0);

      const refreshPayload = refreshCalls[0][1] as Record<string, unknown>;
      expect(Object.keys(refreshPayload).sort()).toEqual(["bearer", "expiresIn"]);
      expect(refreshPayload).not.toHaveProperty("dpop");
      expect(refreshPayload).not.toHaveProperty("DPoP");
    } finally {
      await client.disconnect();
    }
  });

  test("refresh ack envelope shape", async () => {
    const initial = await loginDpop("alice", 3600);
    let current = initial;

    const getCredentials = jest.fn(async () => ({
      bearer: current.bearer,
      expiresIn: current.expiresIn,
    }));

    const client = new Zephyr({
      url: getUrl(),
      auth: createDpopBearerAuthStrategy({
        getBearerCredentials: getCredentials,
        privateKey,
        publicJwk,
      }),
      socketOptions: { transports: ["websocket"], forceNew: true },
    });

    try {
      await client.connect();

      current = await loginDpop("alice", 7200);

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
