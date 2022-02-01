import { SessionStatus } from "../../common";
import { getTestFlowSession } from "../../test/entity";
import { rejectFlowController } from "./reject-flow";

describe("rejectFlowController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        flowSessionCache: {
          update: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
      entity: { flowSession: getTestFlowSession() },
    };
  });

  test("should resolve", async () => {
    await expect(rejectFlowController(ctx)).resolves.toStrictEqual({});

    expect(ctx.cache.flowSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SessionStatus.REJECTED,
      }),
    );
  });
});
