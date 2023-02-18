import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestInvalidToken, createTestRefreshSession } from "../../../fixtures/entity";
import { oauthRevokeController } from "./revoke";

describe("oauthRevokeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        invalidTokenCache: createMockCache(createTestInvalidToken),
      },
      data: {
        token: "jwt.jwt.jwt",
      },
      jwt: {
        verify: jest.fn().mockImplementation(() => ({
          id: "id",
          expiresIn: 77,
          session: "sessionId",
          type: "access_token",
        })),
      },
      repository: {
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };
  });

  test("should resolve for access token", async () => {
    await expect(oauthRevokeController(ctx)).resolves.toBeUndefined();

    expect(ctx.jwt.verify).toHaveBeenCalled();
    expect(ctx.cache.invalidTokenCache.create).toHaveBeenCalled();
    expect(ctx.repository.refreshSessionRepository.deleteMany).not.toHaveBeenCalled();
  });

  test("should resolve for refresh token", async () => {
    ctx.jwt.verify.mockImplementation(() => ({
      id: "id",
      expiresIn: 77,
      session: "sessionId",
      type: "refresh_token",
    }));

    await expect(oauthRevokeController(ctx)).resolves.toBeUndefined();

    expect(ctx.jwt.verify).toHaveBeenCalled();
    expect(ctx.cache.invalidTokenCache.create).toHaveBeenCalled();
    expect(ctx.repository.refreshSessionRepository.deleteMany).toHaveBeenCalled();
  });
});
