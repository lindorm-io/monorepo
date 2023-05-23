import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestAuthorizationRequest } from "../../fixtures/entity";
import { createAuthorizationVerifyUri as _createAuthorizationVerifyRedirectUri } from "../../util";
import { confirmLoginController } from "./confirm-login";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const createAuthorizationVerifyRedirectUri = _createAuthorizationVerifyRedirectUri as jest.Mock;

describe("confirmLoginController", () => {
  let ctx: any;
  let authorizationRequest = createTestAuthorizationRequest({
    state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
  });

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationRequestCache: createMockRedisRepository(createTestAuthorizationRequest),
      },
      data: {
        identityId: "5902daa2-2d3b-40e7-ab97-3dcebe190b98",
        levelOfAssurance: 3,
        metadata: { ip: "127.0.0.1" },
        methods: ["phone"],
        remember: true,
        singleSignOn: true,
      },
      entity: {
        authorizationRequest,
      },
      logger: createMockLogger(),
    };

    createAuthorizationVerifyRedirectUri.mockReturnValue("redirect-uri");
  });

  test("should resolve", async () => {
    await expect(confirmLoginController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.redis.authorizationRequestCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedLogin: {
          identityId: "5902daa2-2d3b-40e7-ab97-3dcebe190b98",
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 3,
          metadata: { ip: "127.0.0.1" },
          methods: ["phone"],
          remember: true,
          singleSignOn: true,
        },
        status: expect.objectContaining({ login: "confirmed" }),
      }),
    );
  });
});
