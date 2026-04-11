import { Amphora, IAmphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { Server as HttpServer } from "http";
import { PylonIo } from "./PylonIo";

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
      connectionMiddleware?: Array<any>;
    } = {},
  ): PylonIo => {
    const io = new PylonIo(http, {
      amphora,
      logger: createMockLogger(),
      environment: "test",
      cors: overrides.cors,
      socket: {
        enabled: true,
        listeners: [],
        connectionMiddleware: overrides.connectionMiddleware,
      },
    } as any);

    const useSpies: Array<jest.Mock> = [];
    const originalOf = io.server.of.bind(io.server);
    (io.server as any).of = jest.fn((ns: string) => {
      const namespace = originalOf(ns);
      if (!(namespace as any).__useSpy) {
        const useSpy = jest.fn((fn: any) => {
          (namespace as any).__runner = fn;
          return namespace;
        });
        namespace.use = useSpy as any;
        (namespace as any).__useSpy = useSpy;
        useSpies.push(useSpy);
      }
      namespace.on = jest.fn() as any;
      return namespace;
    });

    io.load();

    return io;
  };

  const invokeRunner = (
    io: PylonIo,
    ns: string,
    socketOverrides: any = {},
  ): Promise<Error | undefined> => {
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
});
