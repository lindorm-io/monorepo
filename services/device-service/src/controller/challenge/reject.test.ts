import { createMockCache } from "@lindorm-io/redis";
import { createTestChallengeSession } from "../../fixtures/entity";
import { rejectChallengeController } from "./reject";

describe("rejectChallengeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        challengeSessionCache: createMockCache(createTestChallengeSession),
      },
      entity: {
        challengeSession: createTestChallengeSession(),
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectChallengeController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.challengeSessionCache.destroy).toHaveBeenCalled();
  });
});
