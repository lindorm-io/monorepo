import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestAccessToken } from "../../fixtures/entity";
import { revokeTokenController } from "./revoke";
import { resolveTokenSession as _resolveTokenSession } from "../../handler";

jest.mock("../../handler");

const resolveTokenSession = _resolveTokenSession as jest.Mock;

describe("oauthRevokeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        opaqueTokenCache: createMockRedisRepository(createTestAccessToken),
      },
      data: {
        token: "jwt.jwt.jwt",
      },
    };

    resolveTokenSession.mockResolvedValue(createTestAccessToken());
  });

  test("should resolve", async () => {
    await expect(revokeTokenController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.opaqueTokenCache.destroy).toHaveBeenCalled();
  });
});
