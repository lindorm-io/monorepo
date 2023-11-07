import { SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { getAuthenticationCodeController } from "./get-authentication-code";

describe("getAuthenticationCodeController", () => {
  let ctx: any;

  beforeEach(() => {
    const authenticationSession = createTestAuthenticationSession({
      confirmedFederationLevel: 0,
      confirmedFederationProvider: null,
      confirmedStrategies: [],
      status: SessionStatus.CONFIRMED,
    });

    ctx = {
      redis: {
        authenticationSessionCache: createMockRedisRepository(createTestAuthenticationSession),
      },
      entity: {
        authenticationSession,
      },
    };
  });

  test("should resolve", async () => {
    await expect(getAuthenticationCodeController(ctx)).resolves.toStrictEqual({
      body: {
        code: expect.any(String),
        mode: "oauth",
      },
    });

    expect(ctx.redis.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        code: expect.any(String),
        status: "code",
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.REJECTED;

    await expect(getAuthenticationCodeController(ctx)).rejects.toThrow(ClientError);
  });
});
