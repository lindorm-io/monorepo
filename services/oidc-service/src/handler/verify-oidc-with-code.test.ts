import { verifyOidcWithCode } from "./verify-oidc-with-code";
import { logger } from "../test/logger";
import { getTestOidcSession } from "../test/entity";
import { ServerError } from "@lindorm-io/errors";

describe("verifyOidcWithCode", () => {
  let ctx: any;
  let oidcSession: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          post: jest.fn().mockResolvedValue({ data: { accessToken: "jwt.jwt.jwt" } }),
          get: jest.fn().mockResolvedValue({ data: { sub: "sub", claim: true } }),
        },
      },
      logger,
    };

    oidcSession = getTestOidcSession();
  });

  test("should resolve", async () => {
    await expect(verifyOidcWithCode(ctx, oidcSession, "code")).resolves.toStrictEqual({
      sub: "sub",
      claim: true,
    });
  });

  test("should throw on invalid provider", async () => {
    oidcSession = getTestOidcSession({
      provider: "wrong",
    });

    await expect(verifyOidcWithCode(ctx, oidcSession, "code")).rejects.toThrow(ServerError);
  });
});
