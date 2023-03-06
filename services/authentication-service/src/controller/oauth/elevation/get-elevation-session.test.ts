import { getElevationSessionController } from "./get-elevation-session";
import { getOauthElevationSession as _getOauthElevationSession } from "../../../handler";
import { mockFetchOauthElevationSession } from "../../../fixtures/axios";
import { OpenIdClientType } from "@lindorm-io/common-types";

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
        status: "pending",
        client: {
          id: expect.any(String),
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
          type: OpenIdClientType.PUBLIC,
        },
        tenant: {
          id: expect.any(String),
          name: "Test Tenant",
        },
      },
    });
  });
});
