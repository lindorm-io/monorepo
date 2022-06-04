import { createMockCache } from "@lindorm-io/redis";
import { getTestChallengeSession } from "../../test/entity";
import { rejectChallengeController } from "./reject";

describe("rejectChallengeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        challengeSessionCache: createMockCache(),
      },
      entity: {
        challengeSession: getTestChallengeSession(),
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectChallengeController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.challengeSessionCache.destroy).toHaveBeenCalled();
  });
});
