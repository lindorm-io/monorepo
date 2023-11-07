import { createTestFederationSession } from "../../fixtures/entity";
import { authenticateIdentity } from "./authenticate-identity";

describe("axiosAuthenticateFederationIdentity", () => {
  let ctx: any;
  let federationSession: any;

  beforeEach(() => {
    ctx = {
      axios: {
        identityClient: {
          post: jest.fn().mockResolvedValue(undefined),
        },
        oauthClient: "oauthClient",
      },
    };

    federationSession = createTestFederationSession();
  });

  test("should resolve", async () => {
    await expect(
      authenticateIdentity(ctx, federationSession, { provider: "provider", subject: "subject" }),
    ).resolves.toStrictEqual({ identityId: federationSession.identityId });

    expect(ctx.axios.identityClient.post).toHaveBeenCalled();
  });
});
