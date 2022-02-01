import { SessionStatus } from "../../common";
import { getTestEnrolmentSession, getTestRdcSession } from "../../test/entity";
import { updateEnrolmentStatus } from "./update-enrolment-status";

describe("updateEnrolmentStatus", () => {
  let ctx: any;
  let rdc: any;

  beforeEach(() => {
    ctx = {
      cache: {
        enrolmentSessionCache: {
          find: jest.fn().mockResolvedValue(
            getTestEnrolmentSession({
              status: SessionStatus.PENDING,
            }),
          ),
          update: jest.fn(),
        },
      },
    };
    rdc = getTestRdcSession({
      status: SessionStatus.CONFIRMED,
    });
  });

  test("should resolve with rdc session status", async () => {
    await expect(updateEnrolmentStatus(ctx, rdc)).resolves.toBeUndefined();

    expect(ctx.cache.enrolmentSessionCache.update).toHaveBeenCalled();
  });
});
