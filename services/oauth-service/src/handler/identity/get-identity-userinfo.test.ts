import { Scope } from "../../common";
import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { getIdentityUserinfo } from "./get-identity-userinfo";

jest.mock("../axios");

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
    await expect(
      getIdentityUserinfo(ctx, "identityId", [Scope.OPENID, Scope.ADDRESS]),
    ).resolves.toMatchSnapshot();

    expect(ctx.axios.identityClient.get).toHaveBeenCalled();
  });
});
