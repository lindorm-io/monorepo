import { createMockCache } from "@lindorm-io/redis";
import { createTestConsentSession } from "../../fixtures/entity";
import { rejectConsentController } from "./reject-consent";
import { rejectOauthConsentSession as _rejectOauthConsentSession } from "../../handler";

jest.mock("../../handler");

const rejectOauthConsentSession = _rejectOauthConsentSession as jest.Mock;

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

    rejectOauthConsentSession.mockResolvedValue({ redirectTo: "https://reject" });
  });

  test("should resolve", async () => {
    await expect(rejectConsentController(ctx)).resolves.toStrictEqual({
      redirect: "https://reject",
    });

    expect(rejectOauthConsentSession).toHaveBeenCalled();
    expect(ctx.cache.consentSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
