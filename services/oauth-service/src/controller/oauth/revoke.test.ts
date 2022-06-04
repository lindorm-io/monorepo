import { oauthRevokeController } from "./revoke";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";

describe("oauthRevokeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        invalidTokenCache: createMockCache(),
      },
      data: {
        token: "jwt.jwt.jwt",
      },
      jwt: {
        verify: jest.fn().mockImplementation(() => ({
          id: "id",
          expiresIn: 77,
          sessionId: "sessionId",
          type: "access_token",
        })),
      },
      repository: {
        refreshSessionRepository: createMockRepository(),
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
      sessionId: "sessionId",
      type: "refresh_token",
    }));

    await expect(oauthRevokeController(ctx)).resolves.toBeUndefined();

    expect(ctx.jwt.verify).toHaveBeenCalled();
    expect(ctx.cache.invalidTokenCache.create).toHaveBeenCalled();
    expect(ctx.repository.refreshSessionRepository.deleteMany).toHaveBeenCalled();
  });
});
