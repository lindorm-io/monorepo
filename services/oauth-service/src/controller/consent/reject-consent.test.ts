import MockDate from "mockdate";
import { getTestAuthorizationSession } from "../../test/entity";
import { rejectConsentController } from "./reject-consent";
import { logger } from "../../test/logger";
import { SessionStatus } from "../../common";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: {
          update: jest.fn(),
        },
      },
      entity: {
        authorizationSession: getTestAuthorizationSession(),
      },
      logger,
    };
  });

  test("should resolve", async () => {
    await expect(rejectConsentController(ctx)).resolves.toStrictEqual({
      body: {
        redirectTo:
          "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=consent_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        consentStatus: SessionStatus.REJECTED,
      }),
    );
  });
});
