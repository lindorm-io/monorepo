import { getElevationSessionDataController } from "./get-elevation-session-data";
import { fetchOauthElevationData as _fetchOauthElevationInfo } from "../../../handler";

jest.mock("../../../handler");

const fetchOauthElevationInfo = _fetchOauthElevationInfo as jest.Mock;

describe("getElevationSessionDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthElevationInfo.mockResolvedValue({
      elevationStatus: "elevationStatus",
    });
  });

  test("should resolve", async () => {
    await expect(getElevationSessionDataController(ctx)).resolves.toStrictEqual({
      body: {
        status: "elevationStatus",
      },
    });
  });
});
