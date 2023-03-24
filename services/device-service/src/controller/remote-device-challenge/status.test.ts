import { EntityNotFoundError } from "@lindorm-io/entity";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { getRdcSessionStatusController } from "./status";
import { createTestRdcSession } from "../../fixtures/entity";

describe("getRdcSessionStatusController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        rdcSessionCache: createMockRedisRepository(createTestRdcSession),
      },
      data: {
        id: "id",
      },
    };
  });

  test("should resolve with rdc session status", async () => {
    await expect(getRdcSessionStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "pending",
      },
    });
  });

  test("should default to expired", async () => {
    ctx.redis.rdcSessionCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(getRdcSessionStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "expired",
      },
    });
  });
});
