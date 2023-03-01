import { getElevationSessionController } from "./get-elevation-session";
import { getOauthElevationSession as _getOauthElevationSession } from "../../../handler";
import { mockFetchOauthElevationSession } from "../../../fixtures/axios";

jest.mock("../../../handler");

const getOauthElevationSession = _getOauthElevationSession as jest.Mock;

describe("getElevationSessionDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    getOauthElevationSession.mockResolvedValue(mockFetchOauthElevationSession());
  });

  test("should resolve", async () => {
    await expect(getElevationSessionController(ctx)).resolves.toStrictEqual({
      body: {
        client: {
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
          tenant: "Test Tenant",
          type: "public",
        },
        status: "pending",
      },
    });
  });
});
