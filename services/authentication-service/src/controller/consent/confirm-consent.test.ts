import { confirmConsentController } from "./confirm-consent";
import { confirmOauthConsentSession as _confirmOauthConsentSession } from "../../handler";
import { createMockCache } from "@lindorm-io/redis";
import { createTestConsentSession } from "../../fixtures/entity";
import { ClientError } from "@lindorm-io/errors";

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
        audiences: ["1ea69be9-7857-420f-b4ef-1eb59e106189"],
        scopes: ["openid", "email", "phone"],
      },
      entity: {
        consentSession: createTestConsentSession({
          requestedAudiences: ["1ea69be9-7857-420f-b4ef-1eb59e106189"],
          requestedScopes: ["openid", "email", "phone"],
          requiredScopes: ["openid", "email"],
        }),
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

  test("should reject wrong audience", async () => {
    ctx.data.audiences = ["b364fe44-5cfb-4648-8ceb-a99ed36f1c04"];

    await expect(confirmConsentController(ctx)).rejects.toThrow(ClientError);
  });

  test("should reject missing scopes", async () => {
    ctx.data.scopes = ["openid"];

    await expect(confirmConsentController(ctx)).rejects.toThrow(ClientError);
  });

  test("should reject wrong scopes", async () => {
    ctx.data.scopes = ["openid", "email", "profile"];

    await expect(confirmConsentController(ctx)).rejects.toThrow(ClientError);
  });
});
