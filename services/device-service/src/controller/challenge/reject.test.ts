import { rejectChallengeController } from "./reject";
import { getTestChallengeSession } from "../../test/entity";

describe("rejectChallengeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        challengeSessionCache: {
          destroy: jest.fn(),
        },
      },
      entity: {
        challengeSession: getTestChallengeSession(),
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectChallengeController(ctx)).resolves.toBeTruthy();

    expect(ctx.cache.challengeSessionCache.destroy).toHaveBeenCalled();
  });
});
