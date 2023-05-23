import { confirmOauthElevation as _confirmOauthElevation } from "../../../handler";
import { confirmElevationRequestController } from "./confirm-elevation-session";

jest.mock("../../../handler");

const confirmOauthElevation = _confirmOauthElevation as jest.Mock;

describe("confirmElevationRequestController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      token: {
        authenticationConfirmationToken: {
          authContextClass: "authContextClass",
          authMethodsReference: "authMethodsReference",
          subject: "subject",
          levelOfAssurance: "levelOfAssurance",
          session: "session",
        },
      },
    };

    confirmOauthElevation.mockResolvedValue({ redirectTo: "confirmOauthElevation" });
  });

  test("should resolve", async () => {
    await expect(confirmElevationRequestController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthElevation" },
    });
  });
});
