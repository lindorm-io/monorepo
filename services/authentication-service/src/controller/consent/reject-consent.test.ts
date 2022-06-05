import { createTestConsentSession } from "../../fixtures/entity";
import { oauthRejectConsent as _oauthRejectConsent } from "../../handler";
import { rejectConsentController } from "./reject-consent";
import { createMockCache } from "@lindorm-io/redis";

jest.mock("../../handler");

const oauthRejectConsent = _oauthRejectConsent as jest.Mock;

describe("rejectConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        consentSessionCache: createMockCache(createTestConsentSession),
      },
      entity: {
        consentSession: createTestConsentSession(),
      },
      deleteCookie: jest.fn(),
    };

    oauthRejectConsent.mockResolvedValue({ redirectTo: "oauthRejectConsent" });
  });

  test("should resolve", async () => {
    await expect(rejectConsentController(ctx)).resolves.toStrictEqual({
      redirect: "oauthRejectConsent",
    });

    expect(oauthRejectConsent).toHaveBeenCalled();
    expect(ctx.cache.consentSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
