import { confirmElevationSessionController } from "./confirm-elevation-session";
import { confirmOauthElevation as _confirmOauthElevation } from "../../../handler";

jest.mock("../../../handler");

const confirmOauthElevation = _confirmOauthElevation as jest.Mock;

describe("confirmElevationSessionController", () => {
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
    await expect(confirmElevationSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthElevation" },
    });
  });
});
