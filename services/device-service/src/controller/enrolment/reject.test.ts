import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestEnrolmentSession } from "../../fixtures/entity";
import { rejectEnrolmentController } from "./reject";

describe("rejectEnrolmentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        enrolmentSessionCache: createMockRedisRepository(createTestEnrolmentSession),
      },
      entity: {
        enrolmentSession: createTestEnrolmentSession({
          id: "7af9ad76-cd7a-4738-8952-1fdc17259176",
          identityId: "b799b044-16db-495a-b7e1-2cf3175d4b54",
        }),
      },
      token: {
        bearerToken: {
          subject: "b799b044-16db-495a-b7e1-2cf3175d4b54",
        },
        enrolmentSessionToken: {
          metadata: { session: "7af9ad76-cd7a-4738-8952-1fdc17259176" },
        },
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectEnrolmentController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.enrolmentSessionCache.destroy).toHaveBeenCalled();
  });
});
