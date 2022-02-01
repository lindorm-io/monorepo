import { getTestConsentSession } from "../../test/entity";
import { oauthConfirmConsent as _oauthConfirmConsent } from "../../handler";
import { confirmConsentController } from "./confirm-consent";

jest.mock("../../handler");

const oauthConfirmConsent = _oauthConfirmConsent as jest.Mock;

describe("confirmConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        consentSessionCache: {
          destroy: jest.fn(),
        },
      },
      data: {
        audiences: ["audience"],
        scopes: ["scope"],
      },
      entity: { consentSession: getTestConsentSession() },
      deleteCookie: jest.fn(),
    };

    oauthConfirmConsent.mockResolvedValue({ redirectTo: "oauthConfirmConsent" });
  });

  test("should resolve", async () => {
    await expect(confirmConsentController(ctx)).resolves.toStrictEqual({
      redirect: "oauthConfirmConsent",
    });

    expect(oauthConfirmConsent).toHaveBeenCalled();
    expect(ctx.cache.consentSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
