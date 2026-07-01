import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createConnectionContextInitialisationMiddleware } from "./connection-context-initialisation-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createConnectionContextInitialisationMiddleware", () => {
  let ctx: any;
  let logger: any;

  beforeEach(() => {
    logger = createMockLogger();
    ctx = {
      handshakeId: "aa9a627d-8296-598c-9589-4ec91d27d056",
      io: {
        socket: {
          id: "009aecca-3bc0-500f-8e67-6dae90188c7d",
          data: {
            app: {
              domain: "test.lindorm.io",
              environment: "test",
              name: "test-app",
              version: "1.0.0",
            },
            tokens: {},
            pylon: {},
          },
          handshake: {
            auth: {},
            headers: {},
          },
        },
      },
    };
  });

  test("should initialise state and child logger", async () => {
    await expect(
      createConnectionContextInitialisationMiddleware(logger)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state).toEqual({
      actor: "unknown",
      app: ctx.io.socket.data.app,
      authorization: { type: "none", value: null },
      client: {
        userAgent: {
          raw: null,
          browser: null,
          os: null,
          deviceType: "unknown",
        },
        app: null,
        build: null,
        channel: null,
        device: null,
        platform: null,
        timezone: null,
      },
      metadata: {
        id: "aa9a627d-8296-598c-9589-4ec91d27d056",
        correlationId: expect.any(String),
        date: expect.any(Date),
        environment: "unknown",
      },
      tokens: {},
    });
    expect(logger.child).toHaveBeenCalledWith(["Handshake"], {
      correlationId: expect.any(String),
      socketId: "009aecca-3bc0-500f-8e67-6dae90188c7d",
    });
  });

  test("should pick up x-correlation-id header", async () => {
    ctx.io.socket.handshake.headers["x-correlation-id"] = "given-correlation-id";

    await createConnectionContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(ctx.state.metadata.correlationId).toBe("given-correlation-id");
  });

  test("should build client context from handshake user-agent and stash it on socket data", async () => {
    ctx.io.socket.handshake.headers["user-agent"] =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

    await createConnectionContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(ctx.state.client.userAgent.browser).toEqual({
      name: "Chrome",
      version: "114",
    });
    expect(ctx.io.socket.data.client).toBe(ctx.state.client);
  });

  test("should pick up bearer token as authorization", async () => {
    ctx.io.socket.handshake.headers.authorization = "Bearer abc123";

    await createConnectionContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(ctx.state.authorization).toEqual({ type: "bearer", value: "abc123" });
  });
});
