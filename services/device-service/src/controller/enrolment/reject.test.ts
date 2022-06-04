import { createMockCache } from "@lindorm-io/redis";
import { getTestEnrolmentSession } from "../../test/entity";
import { rejectEnrolmentController } from "./reject";

describe("rejectEnrolmentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        enrolmentSessionCache: createMockCache(),
      },
      entity: {
        enrolmentSession: getTestEnrolmentSession(),
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectEnrolmentController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.enrolmentSessionCache.destroy).toHaveBeenCalled();
  });
});
