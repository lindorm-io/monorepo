import { SessionStatus } from "@lindorm-io/common-enums";
import { createTestEnrolmentSession, createTestRdcSession } from "../../fixtures/entity";
import { updateEnrolmentStatus } from "./update-enrolment-status";

describe("updateEnrolmentStatus", () => {
  let ctx: any;
  let rdc: any;

  beforeEach(() => {
    ctx = {
      redis: {
        enrolmentSessionCache: {
          find: jest.fn().mockResolvedValue(
            createTestEnrolmentSession({
              id: "439d212a-e91e-4093-bf3b-020adc91cf4d",
              status: SessionStatus.PENDING,
            }),
          ),
          update: jest.fn(),
        },
      },
    };
    rdc = createTestRdcSession({
      enrolmentSessionId: "439d212a-e91e-4093-bf3b-020adc91cf4d",
      status: SessionStatus.CONFIRMED,
    });
  });

  test("should resolve with rdc session status", async () => {
    await expect(updateEnrolmentStatus(ctx, rdc)).resolves.toBeUndefined();

    expect(ctx.redis.enrolmentSessionCache.update).toHaveBeenCalled();
  });
});
