import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestAuthorizationRequest } from "../../fixtures/entity";
import { rejectConsentController } from "./reject-consent";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationRequestCache: createMockRedisRepository(createTestAuthorizationRequest),
      },
      entity: {
        authorizationRequest: createTestAuthorizationRequest({
          state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
        }),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(rejectConsentController(ctx)).resolves.toStrictEqual({
      body: {
        redirectTo:
          "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=consent_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });

    expect(ctx.redis.authorizationRequestCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          consent: "rejected",
        }),
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authorizationRequest.status.consent = "skip";

    await expect(rejectConsentController(ctx)).rejects.toThrow(ClientError);
  });
});
