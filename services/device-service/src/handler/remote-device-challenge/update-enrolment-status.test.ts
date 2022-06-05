import { SessionStatus } from "../../common";
import { createTestEnrolmentSession, createTestRdcSession } from "../../fixtures/entity";
import { updateEnrolmentStatus } from "./update-enrolment-status";

describe("updateEnrolmentStatus", () => {
  let ctx: any;
  let rdc: any;

  beforeEach(() => {
    ctx = {
      cache: {
        enrolmentSessionCache: {
          find: jest.fn().mockResolvedValue(
            createTestEnrolmentSession({
              status: SessionStatus.PENDING,
            }),
          ),
          update: jest.fn(),
        },
      },
    };
    rdc = createTestRdcSession({
      status: SessionStatus.CONFIRMED,
    });
  });

  test("should resolve with rdc session status", async () => {
    await expect(updateEnrolmentStatus(ctx, rdc)).resolves.toBeUndefined();

    expect(ctx.cache.enrolmentSessionCache.update).toHaveBeenCalled();
  });
});
