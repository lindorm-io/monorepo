import { EntityNotFoundError } from "@lindorm-io/entity";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestStrategySession } from "../../fixtures/entity";
import { getStrategyController } from "./get-strategy";

describe("getStrategyInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        strategySessionCache: createMockRedisRepository(createTestStrategySession),
      },
      data: {
        id: "30132ebf-d960-477f-92b0-e9060ad2fe0f",
      },
    };
  });

  test("should resolve", async () => {
    await expect(getStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        expires: "2022-01-01T08:00:00.000Z",
        strategy: "urn:lindorm:auth:strategy:email-otp",
        status: "pending",
      },
    });
  });

  test("should resolve expired", async () => {
    ctx.redis.strategySessionCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(getStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        status: "expired",
      },
    });
  });
});
