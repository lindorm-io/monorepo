import MockDate from "mockdate";
import { SessionStatus } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestElevationSession } from "../../fixtures/entity";
import { rejectElevationController } from "./reject-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectElevationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        elevationSessionCache: createMockCache(createTestElevationSession),
      },
      entity: {
        elevationSession: createTestElevationSession(),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(rejectElevationController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.elevationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SessionStatus.REJECTED,
      }),
    );
  });
});
