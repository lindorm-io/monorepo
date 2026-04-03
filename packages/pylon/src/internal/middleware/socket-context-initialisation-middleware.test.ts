import { Aegis } from "@lindorm/aegis";
import { createMockAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger";
import { createSocketContextInitialisationMiddleware } from "./socket-context-initialisation-middleware";

describe("createSocketContextInitialisationMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
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

    options = {
      amphora: createMockAmphora(),
      issuer: "issuer",
      logger: createMockLogger(),
    };
  });

  test("should initialise context", async () => {
    await expect(
      createSocketContextInitialisationMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.logger).toEqual(expect.any(Object));
    expect(ctx.amphora).toEqual(options.amphora);
    expect(ctx.aegis).toEqual(expect.any(Aegis));
    expect(ctx.conduits.conduit).toEqual(expect.any(Conduit));
  });

  test("should populate state", async () => {
    await createSocketContextInitialisationMiddleware(options)(ctx, jest.fn());

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

  test("should extract bearer authorization from handshake", async () => {
    ctx.socket.handshake.headers.authorization = "Bearer test-token";

    await createSocketContextInitialisationMiddleware(options)(ctx, jest.fn());

    expect(ctx.state.authorization).toEqual({
      type: "bearer",
      value: "test-token",
    });
  });
});
