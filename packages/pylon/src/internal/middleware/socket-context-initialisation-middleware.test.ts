import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createSocketContextInitialisationMiddleware } from "./socket-context-initialisation-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createSocketContextInitialisationMiddleware", () => {
  let ctx: any;
  let logger: any;

  beforeEach(() => {
    logger = createMockLogger();

    ctx = {
      eventId: "aa9a627d-8296-598c-9589-4ec91d27d056",
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
            tokens: { accessToken: { type: "jwt", payload: {} } },
          },
          handshake: {
            auth: {},
            headers: {},
          },
        },
      },
    };
  });

  test("should initialise context state", async () => {
    await expect(
      createSocketContextInitialisationMiddleware(logger)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state).toEqual({
      app: {
        domain: "test.lindorm.io",
        environment: "test",
        name: "test-app",
        version: "1.0.0",
      },
      authorization: { type: "none", value: null },
      metadata: {
        id: "aa9a627d-8296-598c-9589-4ec91d27d056",
        correlationId: expect.any(String),
        date: expect.any(Date),
        environment: "unknown",
      },
      tokens: { accessToken: { type: "jwt", payload: {} } },
    });
  });

  test("should create child logger with event metadata", async () => {
    await createSocketContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(ctx.logger).toEqual(expect.any(Object));
    expect(logger.child).toHaveBeenCalledWith(["Event"], {
      correlationId: expect.any(String),
      eventId: "aa9a627d-8296-598c-9589-4ec91d27d056",
      socketId: "009aecca-3bc0-500f-8e67-6dae90188c7d",
    });
  });

  test("should extract correlationId from ctx.data when present", async () => {
    ctx.data = { correlationId: "custom-correlation-id", text: "hello" };

    await createSocketContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(ctx.state.metadata.correlationId).toBe("custom-correlation-id");
    expect(logger.child).toHaveBeenCalledWith(
      ["Event"],
      expect.objectContaining({
        correlationId: "custom-correlation-id",
      }),
    );
  });

  test("should generate random correlationId when not in payload", async () => {
    ctx.data = { text: "hello" };

    await createSocketContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(ctx.state.metadata.correlationId).toEqual(expect.any(String));
    expect(ctx.state.metadata.correlationId).toHaveLength(36); // UUID format
  });

  test("should extract correlationId from envelope header (priority over data)", async () => {
    ctx.header = { correlationId: "envelope-trace-id" };
    ctx.data = { correlationId: "data-trace-id", text: "hello" };

    await createSocketContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(ctx.state.metadata.correlationId).toBe("envelope-trace-id");
  });

  test("should extract bearer authorization from handshake", async () => {
    ctx.io.socket.handshake.headers.authorization = "Bearer test-token";

    await createSocketContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(ctx.state.authorization).toEqual({
      type: "bearer",
      value: "test-token",
    });
  });
});
