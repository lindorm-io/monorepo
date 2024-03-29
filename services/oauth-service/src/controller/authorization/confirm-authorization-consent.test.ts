import { Scope, SessionStatus } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";
import { createAuthorizationVerifyUri as _createAuthorizationVerifyRedirectUri } from "../../util";
import { confirmAuthorizationConsentController } from "./confirm-authorization-consent";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const createAuthorizationVerifyRedirectUri = _createAuthorizationVerifyRedirectUri as jest.Mock;

describe("confirmAuthorizationConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
      },
      data: {
        audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
        scopes: [
          Scope.ADDRESS,
          Scope.EMAIL,
          Scope.OFFLINE_ACCESS,
          Scope.OPENID,
          Scope.PHONE,
          Scope.PROFILE,
        ],
      },
      entity: {
        authorizationSession: createTestAuthorizationSession({
          requestedConsent: {
            audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
            scopes: [
              Scope.ADDRESS,
              Scope.EMAIL,
              Scope.OFFLINE_ACCESS,
              Scope.OPENID,
              Scope.PHONE,
              Scope.PROFILE,
            ],
          },
        }),
        client: createTestClient(),
      },
      logger: createMockLogger(),
    };

    createAuthorizationVerifyRedirectUri.mockReturnValue("redirect-uri");
  });

  test("should resolve", async () => {
    await expect(confirmAuthorizationConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.redis.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedConsent: {
          audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
          scopes: [
            Scope.ADDRESS,
            Scope.EMAIL,
            Scope.OFFLINE_ACCESS,
            Scope.OPENID,
            Scope.PHONE,
            Scope.PROFILE,
          ],
        },
        status: expect.objectContaining({ consent: "confirmed" }),
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authorizationSession = createTestAuthorizationSession({
      status: {
        login: SessionStatus.CONFIRMED,
        consent: SessionStatus.REJECTED,
        selectAccount: SessionStatus.PENDING,
      },
    });

    await expect(confirmAuthorizationConsentController(ctx)).rejects.toThrow(ClientError);
  });
});
