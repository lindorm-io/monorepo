import { OpenIdClientType } from "@lindorm-io/common-types";
import { mockFetchOauthElevationRequest } from "../../../fixtures/axios";
import { getOauthElevationRequest as _getOauthElevationRequest } from "../../../handler";
import { getElevationRequestController } from "./get-elevation-session";

jest.mock("../../../handler");

const getOauthElevationRequest = _getOauthElevationRequest as jest.Mock;

describe("getElevationRequestDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    getOauthElevationRequest.mockResolvedValue(mockFetchOauthElevationRequest());
  });

  test("should resolve", async () => {
    await expect(getElevationRequestController(ctx)).resolves.toStrictEqual({
      body: {
        status: "pending",
        client: {
          id: expect.any(String),
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
          singleSignOn: true,
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
