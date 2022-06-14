import { getStrategyStatusController } from "./get-strategy-status";
import { createMockCache } from "@lindorm-io/redis";
import { createTestStrategySession } from "../../fixtures/entity";
import { EntityNotFoundError } from "@lindorm-io/entity";

describe("getStrategyStatusController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        strategySessionCache: createMockCache(createTestStrategySession),
      },
      data: {
        id: "30132ebf-d960-477f-92b0-e9060ad2fe0f",
      },
    };
  });

  test("should resolve", async () => {
    await expect(getStrategyStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "pending",
      },
    });
  });

  test("should resolve expired", async () => {
    ctx.cache.strategySessionCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(getStrategyStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "expired",
      },
    });
  });
});
