import MockDate from "mockdate";
import { confirmLoginController } from "./confirm-login";
import { createAuthorizationVerifyUri as _createAuthorizationVerifyRedirectUri } from "../../util";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestAuthorizationSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const createAuthorizationVerifyRedirectUri = _createAuthorizationVerifyRedirectUri as jest.Mock;

describe("confirmLoginController", () => {
  let ctx: any;
  let authorizationSession = createTestAuthorizationSession({
    state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
  });

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
      },
      data: {
        identityId: "5902daa2-2d3b-40e7-ab97-3dcebe190b98",
        levelOfAssurance: 3,
        metadata: { ip: "127.0.0.1" },
        methods: ["phone"],
        remember: true,
        sso: true,
      },
      entity: {
        authorizationSession,
      },
      logger: createMockLogger(),
    };

    createAuthorizationVerifyRedirectUri.mockImplementation(() => "redirect-uri");
  });

  test("should resolve", async () => {
    await expect(confirmLoginController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.redis.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedLogin: {
          identityId: "5902daa2-2d3b-40e7-ab97-3dcebe190b98",
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 3,
          metadata: { ip: "127.0.0.1" },
          methods: ["phone"],
          remember: true,
          sso: true,
        },
        status: expect.objectContaining({ login: "confirmed" }),
      }),
    );
  });
});
