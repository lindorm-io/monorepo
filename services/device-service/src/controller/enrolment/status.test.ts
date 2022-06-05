import { EntityNotFoundError } from "@lindorm-io/entity";
import { createMockCache } from "@lindorm-io/redis";
import { getEnrolmentStatusController } from "./status";
import { createTestRdcSession } from "../../fixtures/entity";

describe("getEnrolmentStatusController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        enrolmentSessionCache: createMockCache(createTestRdcSession),
      },
      data: {
        id: "id",
      },
    };
  });

  test("should resolve with enrolment session status", async () => {
    await expect(getEnrolmentStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "pending",
      },
    });
  });

  test("should default to expired", async () => {
    ctx.cache.enrolmentSessionCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(getEnrolmentStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "expired",
      },
    });
  });
});
