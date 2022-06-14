import { confirmConsentController } from "./confirm-consent";
import { confirmOauthConsentSession as _confirmOauthConsentSession } from "../../handler";
import { createMockCache } from "@lindorm-io/redis";
import { createTestConsentSession } from "../../fixtures/entity";

jest.mock("../../handler");

const confirmOauthConsentSession = _confirmOauthConsentSession as jest.Mock;

describe("confirmConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        consentSessionCache: createMockCache(createTestConsentSession),
      },
      data: {
        audiences: ["audience"],
        scopes: ["scope"],
      },
      entity: {
        consentSession: createTestConsentSession(),
      },
      deleteCookie: jest.fn(),
    };

    confirmOauthConsentSession.mockResolvedValue({ redirectTo: "https://confirm" });
  });

  test("should resolve", async () => {
    await expect(confirmConsentController(ctx)).resolves.toStrictEqual({
      redirect: "https://confirm",
    });

    expect(confirmOauthConsentSession).toHaveBeenCalled();
    expect(ctx.cache.consentSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
