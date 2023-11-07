import { updateIdentityUserinfo } from "./update-identity-userinfo";

describe("axiosUpdateIdentityUserinfo", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        identityClient: {
          put: jest.fn(),
        },
        oauthClient: "oauthClient",
      },
    };
  });

  test("should resolve", async () => {
    await expect(
      updateIdentityUserinfo(ctx, "identityId", {
        provider: "provider",
        sub: "subject",
        givenName: "given",
      }),
    ).resolves.toBeUndefined();

    expect(ctx.axios.identityClient.put).toHaveBeenCalled();
  });
});
