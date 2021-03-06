import { calculateUpdatedLoa as _calculateUpdatedLoa } from "./calculate-updated-loa";
import { createTestBrowserSession } from "../fixtures/entity";
import { getUnixTime } from "date-fns";
import { updateSessionWithAuthToken } from "./update-session-with-auth-token";

jest.mock("./calculate-updated-loa");

const calculateUpdatedLoa = _calculateUpdatedLoa as jest.Mock;

describe("updateSessionWithAuthToken", () => {
  let session: any;
  let token: any;

  beforeEach(() => {
    session = createTestBrowserSession({
      acrValues: ["loa_2"],
      amrValues: ["email_otp"],
      latestAuthentication: new Date("2000-01-01T01:00:00.000Z"),
      levelOfAssurance: 2,
    });

    token = {
      authMethodsReference: ["email_otp", "device_challenge"],
      authTime: getUnixTime(new Date("2020-01-01T02:00:00.000Z")),
    };

    calculateUpdatedLoa.mockImplementation(() => 3);
  });

  test("should resolve", () => {
    expect(updateSessionWithAuthToken(session, token)).toStrictEqual(
      expect.objectContaining({
        acrValues: ["loa_3"],
        amrValues: ["device_challenge", "email_otp"],
        latestAuthentication: new Date("2020-01-01T02:00:00.000Z"),
        levelOfAssurance: 3,
      }),
    );
  });
});
