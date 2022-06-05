import { SessionStatus } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { createTestFlowSession } from "../../fixtures/entity";
import { rejectFlowController } from "./reject-flow";

describe("rejectFlowController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        flowSessionCache: createMockCache(createTestFlowSession),
      },
      entity: {
        flowSession: createTestFlowSession(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(rejectFlowController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.flowSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SessionStatus.REJECTED,
      }),
    );
  });
});
