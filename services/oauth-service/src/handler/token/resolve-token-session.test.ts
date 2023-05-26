import { createOpaqueToken, createTestJwt } from "@lindorm-io/jwt";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { OpaqueToken } from "../../entity";
import { createTestAccessToken } from "../../fixtures/entity";
import { getTestAccessToken } from "../../fixtures/integration";
import { configuration } from "../../server/configuration";
import { resolveTokenSession } from "./resolve-token-session";

describe("resolveTokenSession", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        opaqueTokenCache: createMockRedisRepository(createTestAccessToken),
      },
      jwt: createTestJwt({ issuer: configuration.server.issuer }),
      token: {},
    };
  });

  test("should resolve from opaque token", async () => {
    const opaque = createOpaqueToken();

    ctx.redis.opaqueTokenCache.find.mockResolvedValue(
      createTestAccessToken({
        id: opaque.id,
        signature: opaque.signature,
      }),
    );

    await expect(resolveTokenSession(ctx, opaque.token)).resolves.toStrictEqual(
      expect.any(OpaqueToken),
    );
  });

  test("should resolve from jwt token", async () => {
    await expect(resolveTokenSession(ctx, getTestAccessToken())).resolves.toStrictEqual(
      expect.any(OpaqueToken),
    );
  });
});
