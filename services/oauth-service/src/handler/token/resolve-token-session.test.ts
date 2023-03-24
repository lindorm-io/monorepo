import { OpaqueToken } from "../../entity";
import { configuration } from "../../server/configuration";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createOpaqueToken } from "../../util";
import { createTestAccessToken } from "../../fixtures/entity";
import { createTestJwt } from "@lindorm-io/jwt";
import { getTestAccessToken } from "../../fixtures/integration";
import { resolveTokenSession } from "./resolve-token-session";

describe("resolveTokenSession", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        opaqueTokenCache: createMockRedisRepository(createTestAccessToken),
      },
      jwt: createTestJwt({ issuer: configuration.server.issuer }),
    };
  });

  test("should resolve from opaque token", async () => {
    await expect(resolveTokenSession(ctx, createOpaqueToken())).resolves.toStrictEqual(
      expect.any(OpaqueToken),
    );
  });

  test("should resolve from jwt token", async () => {
    await expect(resolveTokenSession(ctx, getTestAccessToken())).resolves.toStrictEqual(
      expect.any(OpaqueToken),
    );
  });
});
