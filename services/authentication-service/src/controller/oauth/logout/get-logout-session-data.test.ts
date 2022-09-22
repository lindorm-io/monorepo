import { getLogoutSessionDataController } from "./get-logout-session-data";
import { fetchOauthLogoutData as _fetchOauthLogoutInfo } from "../../../handler";

jest.mock("../../../handler");

const fetchOauthLogoutInfo = _fetchOauthLogoutInfo as jest.Mock;

describe("getLogoutSessionDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthLogoutInfo.mockResolvedValue({
      logoutStatus: "logoutStatus",
      client: {
        name: "name",
        description: "description",
        logoUri: "logoUri",
      },
    });
  });

  test("should resolve", async () => {
    await expect(getLogoutSessionDataController(ctx)).resolves.toStrictEqual({
      body: {
        client: {
          description: "description",
          logoUri: "logoUri",
          name: "name",
        },
        status: "logoutStatus",
      },
    });
  });
});
