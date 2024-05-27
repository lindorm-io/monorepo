import { createMockAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger";
import { createHttpTokenMiddleware } from "./http-token-middleware";

describe("createHttpTokenMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      aegis: createMockAegis(),
      logger: createMockLogger(),
      tokens: {},

      request: { body: { id_token: "value" } },
    };

    options = {
      contextKey: "id",
      issuer: "issuer",
    };
  });

  test("should resolve", async () => {
    await expect(
      createHttpTokenMiddleware(options)("request.body.id_token")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.tokens.id).toEqual({
      decoded: {},
      header: {},
      payload: {
        subject: "mocked_subject",
      },
    });
  });

  test("should throw", async () => {
    await expect(
      createHttpTokenMiddleware(options)("request.body.other_token")(ctx, jest.fn()),
    ).rejects.toThrow();
  });

  test("should resolve optional", async () => {
    await expect(
      createHttpTokenMiddleware(options)("request.body.missing_token", true)(
        ctx,
        jest.fn(),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.tokens.id).toBeUndefined();
  });
});
