import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { rejectAuthenticationController } from "./reject-authentication";

describe("rejectAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authenticationSessionCache: createMockRedisRepository(createTestAuthenticationSession),
      },
      entity: {
        authenticationSession: createTestAuthenticationSession(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(rejectAuthenticationController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });
});
