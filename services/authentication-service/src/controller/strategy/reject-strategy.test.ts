import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestStrategySession } from "../../fixtures/entity";
import { rejectStrategyController } from "./reject-strategy";

describe("rejectStrategyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        strategySessionCache: createMockRedisRepository(createTestStrategySession),
      },
      entity: {
        strategySession: createTestStrategySession(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(rejectStrategyController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.strategySessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });
});
