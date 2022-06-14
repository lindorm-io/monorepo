import { createMockCache } from "@lindorm-io/redis";
import { createTestStrategySession } from "../../fixtures/entity";
import { rejectStrategyController } from "./reject-strategy";

describe("rejectStrategyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        strategySessionCache: createMockCache(createTestStrategySession),
      },
      entity: {
        strategySession: createTestStrategySession(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(rejectStrategyController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.strategySessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });
});
