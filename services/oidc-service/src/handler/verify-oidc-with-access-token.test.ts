import { ServerError } from "@lindorm-io/errors";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestOidcSession } from "../test/entity";
import { verifyOidcWithAccessToken } from "./verify-oidc-with-access-token";

describe("verifyOidcWithAccessToken", () => {
  let ctx: any;
  let oidcSession: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          get: jest.fn().mockResolvedValue({ data: { sub: "sub", claim: true } }),
        },
      },
      logger: createMockLogger(),
    };

    oidcSession = getTestOidcSession();
  });

  test("should resolve", async () => {
    await expect(verifyOidcWithAccessToken(ctx, oidcSession, "jwt.jwt.jwt")).resolves.toStrictEqual(
      { sub: "sub", claim: true },
    );
  });

  test("should throw on invalid provider", async () => {
    oidcSession = getTestOidcSession({
      provider: "wrong",
    });

    await expect(verifyOidcWithAccessToken(ctx, oidcSession, "jwt.jwt.jwt")).rejects.toThrow(
      ServerError,
    );
  });
});
