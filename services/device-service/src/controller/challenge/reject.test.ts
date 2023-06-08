import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestChallengeSession } from "../../fixtures/entity";
import { rejectChallengeController } from "./reject";

describe("rejectChallengeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        challengeSessionCache: createMockRedisRepository(createTestChallengeSession),
      },
      entity: {
        challengeSession: createTestChallengeSession({
          id: "c6657f43-5794-4668-9a66-6ef6023c218a",
        }),
      },
      token: {
        challengeSessionToken: {
          metadata: { session: "c6657f43-5794-4668-9a66-6ef6023c218a" },
        },
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectChallengeController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.challengeSessionCache.destroy).toHaveBeenCalled();
  });
});
