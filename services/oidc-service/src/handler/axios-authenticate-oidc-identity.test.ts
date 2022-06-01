import { axiosAuthenticateOidcIdentity } from "./axios-authenticate-oidc-identity";
import { getTestOidcSession } from "../test/entity";

describe("axiosAuthenticateOidcIdentity", () => {
  let ctx: any;
  let oidcSession: any;

  beforeEach(() => {
    ctx = {
      axios: {
        identityClient: {
          post: jest.fn().mockResolvedValue({ data: "data" }),
        },
        oauthClient: "oauthClient",
      },
    };

    oidcSession = getTestOidcSession();
  });

  test("should resolve", async () => {
    await expect(
      axiosAuthenticateOidcIdentity(ctx, oidcSession, { provider: "provider", subject: "subject" }),
    ).resolves.toStrictEqual("data");

    expect(ctx.axios.identityClient.post).toHaveBeenCalled();
  });
});
