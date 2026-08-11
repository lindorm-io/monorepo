import { Amphora, type IAmphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";
import { Server as HttpServer } from "http";
import { join } from "path";
import { PylonListenerScanner } from "../internal/classes/PylonListenerScanner.js";
import type { PylonSessionHandle } from "../interfaces/index.js";
import { createSessionSecret } from "../internal/utils/session/create-session-secret.js";
import { sessionRecordKit } from "../internal/utils/session/session-record-key.js";
import { PylonError } from "../errors/PylonError.js";
import { PylonListener } from "./PylonListener.js";
import { JwtDriver } from "../drivers/auth/JwtDriver.js";
import { PylonIo } from "./PylonIo.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("PylonIo (handshake chain)", () => {
  let http: HttpServer;
  let amphora: IAmphora;

  beforeEach(() => {
    http = new HttpServer();
    amphora = new Amphora({ logger: createMockLogger() });
  });

  afterEach(() => {
    http.close();
  });

  const createPylonIo = (
    overrides: {
      cors?: any;
      session?: any;
      db?: any;
      kv?: any;
      connectionMiddleware?: Array<any>;
    } = {},
  ): PylonIo => {
    const io = new PylonIo(http, {
      amphora,
      logger: createMockLogger(),
      environment: "test",
      cors: overrides.cors,
      // ⚠ `driver` is REQUIRED on PylonAuthSettings — a session block without one
      // is not a configuration pylon accepts. `JwtDriver` is the minimal honest
      // driver: it pins an issuer and makes no network calls.
      auth: overrides.session
        ? { driver: new JwtDriver({ issuer: "self" }), session: overrides.session }
        : undefined,
      db: overrides.db,
      kv: overrides.kv,
      socket: {
        enabled: true,
        listeners: [],
        connectionMiddleware: overrides.connectionMiddleware,
      },
    } as any);

    const useSpies: Array<Mock> = [];
    const originalOf = io.server.of.bind(io.server);
    (io.server as any).of = vi.fn((ns: string) => {
      const namespace = originalOf(ns);
      if (!(namespace as any).__useSpy) {
        const useSpy = vi.fn((fn: any) => {
          (namespace as any).__runner = fn;
          return namespace;
        });
        namespace.use = useSpy as any;
        (namespace as any).__useSpy = useSpy;
        useSpies.push(useSpy);
      }
      namespace.on = vi.fn() as any;
      return namespace;
    });

    // NOTE: load() is async; tests call `await io.load()` themselves. Keeping
    // createPylonIo sync so tests that assert constructor-time throws can use
    // plain `expect(() => createPylonIo(...)).toThrow(...)`.

    return io;
  };

  const invokeRunner = async (
    io: PylonIo,
    ns: string,
    socketOverrides: any = {},
  ): Promise<Error | undefined> => {
    await io.load();
    const runner = (io.server.of(ns) as any).__runner as (
      s: any,
      next: (err?: Error) => void,
    ) => void;

    const socket: any = {
      id: "socket-test",
      data: {},
      handshake: {
        secure: false,
        auth: {},
        headers: { host: "api.example.com" },
        ...socketOverrides.handshake,
      },
      ...socketOverrides,
    };

    return new Promise((resolve) => {
      runner(socket, (err?: Error) => resolve(err));
    });
  };

  test("should run handshake chain and call next() on success", async () => {
    const seen: Array<string> = [];
    const io = createPylonIo({
      connectionMiddleware: [
        async (ctx: any, next: any) => {
          seen.push(`id:${ctx.io.socket.id}`);
          seen.push(`data:${ctx.io.socket.data.app.environment}`);
          await next();
        },
      ],
    });

    await expect(invokeRunner(io, "/")).resolves.toBeUndefined();
    expect(seen).toEqual(["id:socket-test", "data:test"]);
  });

  test("should propagate errors from the chain to next(err)", async () => {
    const boom = new Error("boom");
    const io = createPylonIo({
      connectionMiddleware: [
        async () => {
          throw boom;
        },
      ],
    });

    await expect(invokeRunner(io, "/")).resolves.toBe(boom);
  });

  test("should reject missing Origin when cors is set", async () => {
    const io = createPylonIo({
      cors: { allowOrigins: ["https://app.example.com"] },
    });

    const err = await invokeRunner(io, "/");
    expect(err).toBeInstanceOf(ClientError);
    expect((err as ClientError).status).toBe(ClientError.Status.Forbidden);
  });

  test("should reject disallowed Origin when cors is set", async () => {
    const io = createPylonIo({
      cors: { allowOrigins: ["https://app.example.com"] },
    });

    const err = await invokeRunner(io, "/", {
      handshake: {
        secure: true,
        auth: {},
        headers: { host: "api.example.com", origin: "https://evil.example.com" },
      },
    });
    expect(err).toBeInstanceOf(ClientError);
    expect((err as ClientError).status).toBe(ClientError.Status.Forbidden);
  });

  test("should accept allow-listed origin", async () => {
    const io = createPylonIo({
      cors: { allowOrigins: ["https://app.example.com"] },
    });

    const err = await invokeRunner(io, "/", {
      handshake: {
        secure: true,
        auth: {},
        headers: { host: "api.example.com", origin: "https://app.example.com" },
      },
    });
    expect(err).toBeUndefined();
  });

  test("should pass through when cors is unset", async () => {
    const io = createPylonIo();

    const err = await invokeRunner(io, "/", {
      handshake: {
        secure: false,
        auth: {},
        headers: { host: "api.example.com" },
      },
    });

    expect(err).toBeUndefined();
  });

  describe("session auto-wiring", () => {
    const validSession = {
      enabled: true,
      sameSite: "lax" as const,
    };
    const validCors = { allowOrigins: ["https://app.example.com"] };

    // The cookie carries the whole handle at the handshake — the row's name AND
    // the secret that opens it — so the stored row is the sealed envelope.
    const handle: PylonSessionHandle = { id: "sid-1", sec: createSessionSecret() };

    const buildProteus = async () => {
      const mockRepo = await createMockRepository();
      (mockRepo.findOne as Mock).mockResolvedValue({
        id: handle.id,
        payloadEncrypted: sessionRecordKit(handle.sec).encrypt({
          id: handle.id,
          accessToken: "access_token",
          scope: [],
        }),
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        issuedAt: new Date("2024-01-01T00:00:00.000Z"),
        subject: "sub-1",
      });

      const mockSession = {
        repository: vi.fn().mockReturnValue(mockRepo),
      };
      const mockProteus: any = await createMockProteusSource();
      mockProteus.session = vi.fn().mockReturnValue(mockSession);
      return { mockProteus, mockRepo };
    };

    test("should throw at construction when session set without cors", () => {
      expect(
        () =>
          new PylonIo(http, {
            amphora,
            logger: createMockLogger(),
            environment: "test",
            auth: { session: validSession },
            socket: { enabled: true, listeners: [] },
          } as any),
      ).toThrow(PylonError);
    });

    test("should throw at construction when session set with cors wildcard", () => {
      expect(
        () =>
          new PylonIo(http, {
            amphora,
            logger: createMockLogger(),
            environment: "test",
            cors: { allowOrigins: "*" },
            auth: { session: validSession },
            socket: { enabled: true, listeners: [] },
          } as any),
      ).toThrow(PylonError);
    });

    test("should throw at construction when session SameSite is 'none'", () => {
      expect(
        () =>
          new PylonIo(http, {
            amphora,
            logger: createMockLogger(),
            environment: "test",
            cors: validCors,
            auth: { session: { ...validSession, sameSite: "none" } },
            socket: { enabled: true, listeners: [] },
          } as any),
      ).toThrow(PylonError);
    });

    test("should throw at construction when session SameSite is unset", () => {
      expect(
        () =>
          new PylonIo(http, {
            amphora,
            logger: createMockLogger(),
            environment: "test",
            cors: validCors,
            auth: { session: { enabled: true } },
            socket: { enabled: true, listeners: [] },
          } as any),
      ).toThrow(PylonError);
    });

    test("should construct when session + valid cors + lax SameSite", () => {
      expect(() =>
        createPylonIo({
          cors: validCors,
          session: validSession,
        }),
      ).not.toThrow();
    });

    test("should auto-wire session middleware into handshake chain", async () => {
      const { mockProteus } = await buildProteus();

      const io = createPylonIo({
        cors: validCors,
        kv: mockProteus,
        session: { ...validSession },
      });

      await io.load();

      const seen: any = {};
      const runner = (io.server.of("/") as any).__runner as (
        s: any,
        next: (err?: Error) => void,
      ) => void;

      // Install a spy mw to observe socket.data
      const socket: any = {
        id: "socket-s",
        data: {},
        handshake: {
          secure: true,
          auth: {},
          headers: {
            host: "api.example.com",
            origin: "https://app.example.com",
            cookie: `pylon_session=${Buffer.from(JSON.stringify(handle)).toString("base64url")}`,
          },
        },
      };

      await new Promise<void>((resolve) => {
        runner(socket, (err?: Error) => {
          seen.err = err;
          resolve();
        });
      });

      expect(seen.err).toBeUndefined();
      expect(socket.data.session).toBeDefined();
      expect(socket.data.session.id).toBe("sid-1");
      expect(socket.data.pylon.auth?.strategy).toBe("session");
    });
  });
});

describe("PylonIo socket.listeners option", () => {
  let http: HttpServer;
  let amphora: IAmphora;

  const listenersDir = join(__dirname, "..", "__fixtures__", "listeners");

  beforeEach(() => {
    http = new HttpServer();
    amphora = new Amphora({ logger: createMockLogger() });
  });

  afterEach(() => {
    http.close();
  });

  const buildIo = (listeners: any): PylonIo => {
    return new PylonIo(http, {
      amphora,
      logger: createMockLogger(),
      environment: "test",
      socket: { enabled: true, listeners },
    } as any);
  };

  test("should scan when given a bare directory path string", async () => {
    const scanSpy = vi.spyOn(PylonListenerScanner.prototype, "scan");
    const io = buildIo(listenersDir);

    await io.load();

    expect(scanSpy).toHaveBeenCalledTimes(1);
    expect(scanSpy).toHaveBeenCalledWith(listenersDir);

    scanSpy.mockRestore();
  });

  test("should accept a bare PylonListener instance and register its namespace", async () => {
    const scanSpy = vi.spyOn(PylonListenerScanner.prototype, "scan");
    const listener = new PylonListener({ namespace: "/solo" });
    const io = buildIo(listener);

    const ofSpy = vi.spyOn(io.server, "of");
    await io.load();

    expect(scanSpy).not.toHaveBeenCalled();
    expect(ofSpy.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(["/", "/solo"]),
    );

    scanSpy.mockRestore();
    ofSpy.mockRestore();
  });

  test("should accept an array of pre-built PylonListener instances", async () => {
    const scanSpy = vi.spyOn(PylonListenerScanner.prototype, "scan");
    const io = buildIo([
      new PylonListener({ namespace: "/alpha" }),
      new PylonListener({ namespace: "/beta" }),
    ]);

    const ofSpy = vi.spyOn(io.server, "of");
    await io.load();

    expect(scanSpy).not.toHaveBeenCalled();
    expect(ofSpy.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(["/", "/alpha", "/beta"]),
    );

    scanSpy.mockRestore();
    ofSpy.mockRestore();
  });

  test("should accept an array of directory path strings and scan each", async () => {
    const scanSpy = vi.spyOn(PylonListenerScanner.prototype, "scan");
    const io = buildIo([listenersDir]);

    await io.load();

    expect(scanSpy).toHaveBeenCalledTimes(1);
    expect(scanSpy).toHaveBeenCalledWith(listenersDir);

    scanSpy.mockRestore();
  });

  test("should accept a mixed array of scanner paths and pre-built listeners", async () => {
    const scanSpy = vi.spyOn(PylonListenerScanner.prototype, "scan");
    const io = buildIo([listenersDir, new PylonListener({ namespace: "/mixed" })]);

    const ofSpy = vi.spyOn(io.server, "of");
    await io.load();

    expect(scanSpy).toHaveBeenCalledTimes(1);
    expect(scanSpy).toHaveBeenCalledWith(listenersDir);
    expect(ofSpy.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(["/", "/mixed"]),
    );

    scanSpy.mockRestore();
    ofSpy.mockRestore();
  });
});

// The socket event chain gets the same four source roles as the http one. The
// dependencies middleware is the first entry PylonIo builds, so running it
// against a socket-shaped ctx proves the wiring end to end rather than through
// a spy on the constructor arguments.
describe("PylonIo source roles", () => {
  let http: HttpServer;

  beforeEach(() => {
    http = new HttpServer();
  });

  afterEach(() => {
    http.close();
  });

  const dependenciesMiddleware = (overrides: Record<string, unknown>): any => {
    const io = new PylonIo(http, {
      amphora: new Amphora({ logger: createMockLogger() }),
      logger: createMockLogger(),
      environment: "test",
      socket: { enabled: true, listeners: [] },
      ...overrides,
    } as any);

    return (io as any).middleware[0];
  };

  const socketCtx = () => ({ logger: createMockLogger(), event: "test:event" }) as any;

  const taggedSource = async (tag: string) => {
    const source: any = await createMockProteusSource();
    source.session = vi.fn().mockReturnValue({ tag });
    return source;
  };

  test("should install ctx.cache from the cache source", async () => {
    const cache = await taggedSource("cache");
    const kv = await taggedSource("kv");

    const ctx = socketCtx();

    await dependenciesMiddleware({ cache, kv })(ctx, vi.fn());

    expect(ctx.cache).toEqual({ tag: "cache" });
    expect(ctx.kv).toEqual({ tag: "kv" });
  });

  test("should fall back to the kv source when no cache is configured", async () => {
    const kv = await taggedSource("kv");

    const ctx = socketCtx();

    await dependenciesMiddleware({ kv })(ctx, vi.fn());

    expect(ctx.cache).toEqual({ tag: "kv" });
  });

  test("should leave ctx.cache undefined when no ephemeral source is configured", async () => {
    const ctx = socketCtx();

    await dependenciesMiddleware({ db: await taggedSource("db") })(ctx, vi.fn());

    expect(ctx.cache).toBeUndefined();
  });
});
