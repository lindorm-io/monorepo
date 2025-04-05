import { createMockAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { AuthorizationType } from "../../enums";
import { createHttpBearerTokenMiddleware } from "./http-bearer-token-middleware";

describe("createHttpBearerTokenMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      aegis: createMockAegis(),
      logger: createMockLogger(),
      state: {
        authorization: {
          type: AuthorizationType.Bearer,
          value: "token",
        },
        tokens: {},
      },
    };

    options = {
      issuer: "issuer",
    };
  });

  test("should resolve", async () => {
    await expect(
      createHttpBearerTokenMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.state.tokens.accessToken).toEqual({
      decoded: {},
      header: {},
      payload: {
        subject: "mocked_subject",
      },
    });
  });

  test("should reject invalid authorization header", async () => {
    ctx.state.authorization.type = AuthorizationType.None;

    await expect(
      createHttpBearerTokenMiddleware(options)(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });
});
