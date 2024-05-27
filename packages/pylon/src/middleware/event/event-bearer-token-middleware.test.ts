import { createMockAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger";
import { createSocketBearerTokenMiddleware } from "./event-bearer-token-middleware";

describe("createSocketBearerTokenMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      aegis: createMockAegis(),
      logger: createMockLogger(),

      socket: {
        data: {
          tokens: {},
        },
        handshake: { auth: { bearer: "token" } },
      },
    };

    options = {
      issuer: "issuer",
    };
  });

  test("should resolve", async () => {
    await expect(
      createSocketBearerTokenMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.socket.data.tokens.bearer).toEqual({
      decoded: {},
      header: {},
      payload: {
        subject: "mocked_subject",
      },
    });
  });
});
