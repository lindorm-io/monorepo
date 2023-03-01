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
        challengeSession: createTestChallengeSession({
          id: "c6657f43-5794-4668-9a66-6ef6023c218a",
        }),
      },
      token: {
        challengeSessionToken: {
          session: "c6657f43-5794-4668-9a66-6ef6023c218a",
        },
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectChallengeController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.challengeSessionCache.destroy).toHaveBeenCalled();
  });
});
