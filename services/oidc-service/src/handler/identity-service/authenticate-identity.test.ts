import { authenticateIdentity } from "./authenticate-identity";
import { createTestOidcSession } from "../../fixtures/entity";

describe("axiosAuthenticateOidcIdentity", () => {
  let ctx: any;
  let oidcSession: any;

  beforeEach(() => {
    ctx = {
      axios: {
        identityClient: {
          post: jest.fn().mockResolvedValue(undefined),
        },
        oauthClient: "oauthClient",
      },
    };

    oidcSession = createTestOidcSession();
  });

  test("should resolve", async () => {
    await expect(
      authenticateIdentity(ctx, oidcSession, { provider: "provider", subject: "subject" }),
    ).resolves.toStrictEqual({ identityId: oidcSession.identityId });

    expect(ctx.axios.identityClient.post).toHaveBeenCalled();
  });
});
