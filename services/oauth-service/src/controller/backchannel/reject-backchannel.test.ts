import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestBackchannelSession } from "../../fixtures/entity";
import { rejectBackchannelController } from "./reject-backchannel";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectBackchannelController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        backchannelSessionCache: createMockRedisRepository(createTestBackchannelSession),
      },
      entity: {
        backchannelSession: createTestBackchannelSession(),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(rejectBackchannelController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.backchannelSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          consent: "rejected",
          login: "rejected",
        }),
      }),
    );
  });
});
