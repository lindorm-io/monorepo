import { getLoginSessionDataController } from "./get-login-session-data";
import { fetchOauthLoginData as _fetchOauthLoginInfo } from "../../../handler";

jest.mock("../../../handler");

const fetchOauthLoginInfo = _fetchOauthLoginInfo as jest.Mock;

describe("getLoginSessionDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthLoginInfo.mockResolvedValue({
      loginStatus: "loginStatus",
      client: {
        name: "name",
        description: "description",
        logoUri: "logoUri",
      },
    });
  });

  test("should resolve", async () => {
    await expect(getLoginSessionDataController(ctx)).resolves.toStrictEqual({
      body: {
        client: {
          description: "description",
          logoUri: "logoUri",
          name: "name",
        },
        status: "loginStatus",
      },
    });
  });
});
