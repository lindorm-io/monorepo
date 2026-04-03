import { createMockLogger } from "@lindorm/logger";
import { createSocketContextInitialisationMiddleware } from "./socket-context-initialisation-middleware";

describe("createSocketContextInitialisationMiddleware", () => {
  let ctx: any;
  let logger: any;

  beforeEach(() => {
    logger = createMockLogger();

    ctx = {
      eventId: "aa9a627d-8296-598c-9589-4ec91d27d056",
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
    };
  });

  test("should initialise context state", async () => {
    await expect(
      createSocketContextInitialisationMiddleware(logger)(ctx, jest.fn()),
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
    await createSocketContextInitialisationMiddleware(logger)(ctx, jest.fn());

    expect(ctx.logger).toEqual(expect.any(Object));
    expect(logger.child).toHaveBeenCalledWith(["Event"], {
      eventId: "aa9a627d-8296-598c-9589-4ec91d27d056",
      socketId: "009aecca-3bc0-500f-8e67-6dae90188c7d",
    });
  });

  test("should extract bearer authorization from handshake", async () => {
    ctx.socket.handshake.headers.authorization = "Bearer test-token";

    await createSocketContextInitialisationMiddleware(logger)(ctx, jest.fn());

    expect(ctx.state.authorization).toEqual({
      type: "bearer",
      value: "test-token",
    });
  });
});
