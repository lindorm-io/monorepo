import { ServerError } from "@lindorm-io/errors";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestOidcSession } from "../test/entity";
import { verifyOidcWithIdToken } from "./verify-oidc-with-id-token";

describe("verifyOidcWithIdToken", () => {
  let ctx: any;
  let oidcSession: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        verify: jest
          .fn()
          .mockImplementation(() => ({ subject: "sub", claims: { given_name: "given" } })),
      },
      logger: createMockLogger(),
    };

    oidcSession = getTestOidcSession();
  });

  test("should resolve", async () => {
    await expect(verifyOidcWithIdToken(ctx, oidcSession, "code")).resolves.toStrictEqual({
      sub: "sub",
      given_name: "given",
    });
  });

  test("should throw on invalid provider", async () => {
    oidcSession = getTestOidcSession({
      provider: "wrong",
    });

    await expect(verifyOidcWithIdToken(ctx, oidcSession, "code")).rejects.toThrow(ServerError);
  });
});
