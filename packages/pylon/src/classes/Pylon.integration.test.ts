import { Amphora, IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { ILogger, Logger } from "@lindorm/logger";
import { join } from "path";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import request from "supertest";
import { Pylon } from "./Pylon";

describe("PylonScanner", () => {
  let pylon: Pylon;
  let amphora: IAmphora;
  let logger: ILogger;

  beforeAll(async () => {
    logger = new Logger({ level: "error", readable: true });

    amphora = new Amphora({
      domain: "http://test.lindorm.io",
      logger,
    });

    amphora.add(
      KryptosKit.from.b64({
        id: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
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
      httpRouters: join(__dirname, "..", "__fixtures__", "routes"),
      socketListeners: join(__dirname, "..", "__fixtures__", "listeners"),
      name: "@lindorm/pylon-scanner-test",
      port: 0,
      version: "0.0.1",
    });

    await pylon.start();
  });

  afterAll(async () => {
    await pylon.stop();
  });

  const getPort = (): number => {
    const addr = (pylon as any).server.address();
    return addr.port;
  };

  const connectClient = (): ClientSocket => {
    return ioClient(`http://localhost:${getPort()}`, {
      transports: ["websocket"],
      forceNew: true,
    });
  };

  const waitForConnect = (client: ClientSocket): Promise<void> =>
    new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

  // Route scanner conventions

  test("should handle PylonRouter instance export (escape hatch)", async () => {
    const response = await request(pylon.callback).get("/custom").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "custom",
        method: "GET",
      }),
    );
  });

  test("should handle index.ts file GET export", async () => {
    const response = await request(pylon.callback).get("/v1/users").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "v1/users",
        method: "GET",
      }),
    );
  });

  test("should handle index.ts file POST export with array middleware", async () => {
    const response = await request(pylon.callback)
      .post("/v1/users")
      .send({ name: "test" })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "v1/users",
        method: "POST",
      }),
    );
  });

  test("should handle dynamic [id] param GET", async () => {
    const response = await request(pylon.callback).get("/v1/users/abc123").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "v1/users/:id",
        method: "GET",
        params: expect.objectContaining({ id: "abc123" }),
      }),
    );
  });

  test("should handle dynamic [id] param PUT", async () => {
    const response = await request(pylon.callback)
      .put("/v1/users/abc123")
      .send({ name: "updated" })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "v1/users/:id",
        method: "PUT",
        params: expect.objectContaining({ id: "abc123" }),
      }),
    );
  });

  test("should handle dynamic [id] param DELETE", async () => {
    const response = await request(pylon.callback).delete("/v1/users/abc123").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "v1/users/:id",
        method: "DELETE",
        params: expect.objectContaining({ id: "abc123" }),
      }),
    );
  });

  test("should handle route group (no 'admin' in URL path)", async () => {
    const response = await request(pylon.callback).get("/v1/dashboard").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "v1/dashboard",
        method: "GET",
      }),
    );
  });

  test("should handle catch-all [...path] route", async () => {
    const response = await request(pylon.callback).get("/proxy/foo/bar/baz").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "proxy/catch-all",
        method: "GET",
      }),
    );
    expect(response.body.params).toBeDefined();
  });

  test("should handle optional catch-all [[...slug]] with trailing slash", async () => {
    const response = await request(pylon.callback).get("/api/").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "api/optional-catch-all",
        method: "GET",
      }),
    );
  });

  test("should handle optional catch-all [[...slug]] with params", async () => {
    const response = await request(pylon.callback).get("/api/one/two").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        route: "api/optional-catch-all",
        method: "GET",
      }),
    );
    expect(response.body.params).toBeDefined();
  });

  // Middleware inheritance

  test("should apply root middleware to scanned routes", async () => {
    const response = await request(pylon.callback).get("/proxy/test-path").expect(200);

    expect(response.body.middleware_chain).toEqual(["root"]);
  });

  test("should apply root + v1 middleware to nested routes", async () => {
    const response = await request(pylon.callback).get("/v1/users").expect(200);

    expect(response.body.middleware_chain).toEqual(["root", "v1"]);
  });

  test("should apply root + v1 + admin middleware through route groups", async () => {
    const response = await request(pylon.callback).get("/v1/dashboard").expect(200);

    expect(response.body.middleware_chain).toEqual(["root", "v1", "admin"]);
  });

  // Built-in routes take priority over scanned routes

  test("should prioritize built-in /health over scanned health route", async () => {
    await request(pylon.callback).get("/health").expect(204);
  });

  // 404 handling

  test("should return 404 for nonexistent routes", async () => {
    await request(pylon.callback).get("/nonexistent").expect(404);
  });

  // Socket listener tests

  describe("socket listeners", () => {
    let client: ClientSocket;

    beforeEach(async () => {
      client = connectClient();
      await waitForConnect(client);
    });

    afterEach(() => {
      client.disconnect();
    });

    test("should handle chat:message event (ON export)", async () => {
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for response")),
          5000,
        );

        client.on("chat:message:response", (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });

        client.emit("chat:message", { text: "hello" });
      });

      expect(response).toEqual(
        expect.objectContaining({
          event: "chat:message",
          data: expect.objectContaining({ text: "hello" }),
        }),
      );
    });

    test("should apply root + chat middleware for chat:message event", async () => {
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for response")),
          5000,
        );

        client.on("chat:message:response", (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });

        client.emit("chat:message", { text: "test" });
      });

      expect(response.middlewareChain).toEqual(["root", "chat"]);
    });

    test("should extract params from dynamic room event", async () => {
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for response")),
          5000,
        );

        client.on("rooms:join:response", (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });

        client.emit("rooms:lobby:join", { user: "alice" });
      });

      expect(response).toEqual(
        expect.objectContaining({
          event: "rooms:lobby:join",
          params: { roomId: "lobby" },
          data: expect.objectContaining({ user: "alice" }),
        }),
      );
    });

    test("should extract different param values", async () => {
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for response")),
          5000,
        );

        client.on("rooms:join:response", (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });

        client.emit("rooms:abc123:join", { user: "bob" });
      });

      expect(response.params).toEqual({ roomId: "abc123" });
    });

    test("should apply root middleware for rooms events", async () => {
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for response")),
          5000,
        );

        client.on("rooms:join:response", (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });

        client.emit("rooms:lobby:join", { user: "bob" });
      });

      expect(response.middlewareChain).toEqual(["root"]);
    });

    test("should handle ONCE with dynamic params on first emit", async () => {
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for response")),
          5000,
        );

        client.on("rooms:leave:response", (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });

        client.emit("rooms:lobby:leave", { user: "charlie" });
      });

      expect(response).toEqual(
        expect.objectContaining({
          event: "rooms:lobby:leave",
          params: { roomId: "lobby" },
          data: expect.objectContaining({ user: "charlie" }),
        }),
      );
    });

    test("should not trigger ONCE listener on second emit", async () => {
      const responses: Array<any> = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for first response")),
          5000,
        );

        client.on("rooms:leave:response", (data: any) => {
          clearTimeout(timeout);
          responses.push(data);
          resolve();
        });

        client.emit("rooms:lobby:leave", { user: "first" });
      });

      // Emit a second time — the ONCE handler should not fire again
      client.emit("rooms:lobby:leave", { user: "second" });

      // Wait briefly for any potential second response
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(responses).toHaveLength(1);
      expect(responses[0].data).toEqual(expect.objectContaining({ user: "first" }));
    });

    test("should support ack — handler responds via ctx.ack", async () => {
      const response = await client.timeout(5000).emitWithAck("echo", { text: "hello" });

      expect(response).toEqual({
        ok: true,
        data: { text: "hello", event: "echo" },
      });
    });

    test("should support nack — handler responds with error via ctx.nack", async () => {
      const response = await client
        .timeout(5000)
        .emitWithAck("nack-test", { value: "test" });

      expect(response).toEqual({
        ok: false,
        error: { code: "test_error", message: "intentional nack" },
      });
    });

    test("should emit error event on unhandled throw", async () => {
      const error = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for error")),
          5000,
        );

        client.on("error", (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });

        client.emit("throw-test", {});
      });

      expect(error).toEqual(
        expect.objectContaining({
          code: "test_throw",
          message: "intentional error",
          name: "ServerError",
        }),
      );
    });
  });
});
