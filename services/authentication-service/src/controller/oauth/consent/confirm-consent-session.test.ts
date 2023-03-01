import { confirmConsentSessionController } from "./confirm-consent-session";
import { confirmOauthConsent as _confirmOauthConsent } from "../../../handler";

jest.mock("../../../handler");

const confirmOauthConsent = _confirmOauthConsent as jest.Mock;

describe("confirmConsentSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "id",
        audiences: "audiences",
        scopes: "scopes",
      },
    };

    confirmOauthConsent.mockResolvedValue({ redirectTo: "confirmOauthConsent" });
  });

  test("should resolve", async () => {
    await expect(confirmConsentSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthConsent" },
    });
  });
});
