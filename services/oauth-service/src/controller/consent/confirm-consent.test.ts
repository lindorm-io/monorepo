import MockDate from "mockdate";
import { confirmConsentController } from "./confirm-consent";
import { createAuthorizationVerifyUri as _createAuthorizationVerifyRedirectUri } from "../../util";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";
import { ClientError } from "@lindorm-io/errors";
import { OpenIdScope, SessionStatus } from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const createAuthorizationVerifyRedirectUri = _createAuthorizationVerifyRedirectUri as jest.Mock;

describe("confirmConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
      },
      data: {
        audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
        scopes: ["address", "email", "offline_access", "openid", "phone", "private", "profile"],
      },
      entity: {
        authorizationSession: createTestAuthorizationSession({
          requestedConsent: {
            audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
            scopes: Object.values(OpenIdScope),
          },
        }),
        client: createTestClient(),
      },
      logger: createMockLogger(),
    };

    createAuthorizationVerifyRedirectUri.mockImplementation(() => "redirect-uri");
  });

  test("should resolve", async () => {
    await expect(confirmConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.redis.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedConsent: {
          audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
          scopes: ["address", "email", "offline_access", "openid", "phone", "private", "profile"],
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

    await expect(confirmConsentController(ctx)).rejects.toThrow(ClientError);
  });
});
