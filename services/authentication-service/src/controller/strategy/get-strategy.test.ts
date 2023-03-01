import { getStrategyController } from "./get-strategy";
import { createMockCache } from "@lindorm-io/redis";
import { createTestStrategySession } from "../../fixtures/entity";
import { EntityNotFoundError } from "@lindorm-io/entity";

describe("getStrategyInfoController", () => {
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
    await expect(getStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        expires: new Date("2022-01-01T08:00:00.000Z"),
        strategy: "email_otp",
        status: "pending",
      },
    });
  });

  test("should resolve expired", async () => {
    ctx.cache.strategySessionCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(getStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        status: "expired",
      },
    });
  });
});
