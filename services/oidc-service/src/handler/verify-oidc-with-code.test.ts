import { ServerError } from "@lindorm-io/errors";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestOidcSession } from "../test/entity";
import { verifyOidcWithCode } from "./verify-oidc-with-code";

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
      logger: createMockLogger(),
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
