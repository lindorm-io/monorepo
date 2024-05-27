import { createMockAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger";
import { createHttpBearerTokenMiddleware } from "./http-bearer-token-middleware";

describe("createHttpBearerTokenMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      aegis: createMockAegis(),
      logger: createMockLogger(),
      tokens: {},

      get: jest.fn().mockReturnValue("Bearer token"),
    };

    options = {
      issuer: "issuer",
    };
  });

  test("should resolve", async () => {
    await expect(
      createHttpBearerTokenMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.tokens.bearer).toEqual({
      decoded: {},
      header: {},
      payload: {
        subject: "mocked_subject",
      },
    });
  });
});
