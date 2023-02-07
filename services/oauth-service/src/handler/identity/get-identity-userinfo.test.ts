import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { getIdentityUserinfo } from "./get-identity-userinfo";

describe("getIdentityUserinfo", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        identityClient: {
          get: jest.fn().mockResolvedValue({
            data: TEST_GET_USERINFO_RESPONSE,
          }),
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(getIdentityUserinfo(ctx, "accessToken")).resolves.toMatchSnapshot();

    expect(ctx.axios.identityClient.get).toHaveBeenCalled();
  });
});
