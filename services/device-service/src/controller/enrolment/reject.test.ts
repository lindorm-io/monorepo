import { createMockCache } from "@lindorm-io/redis";
import { createTestEnrolmentSession } from "../../fixtures/entity";
import { rejectEnrolmentController } from "./reject";

describe("rejectEnrolmentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        enrolmentSessionCache: createMockCache(createTestEnrolmentSession),
      },
      entity: {
        enrolmentSession: createTestEnrolmentSession(),
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectEnrolmentController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.enrolmentSessionCache.destroy).toHaveBeenCalled();
  });
});
