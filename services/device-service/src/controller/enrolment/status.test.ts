import { EntityNotFoundError } from "@lindorm-io/entity";
import { getEnrolmentStatusController } from "./status";
import { getTestRdcSession } from "../../test/entity";

describe("getEnrolmentStatusController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        enrolmentSessionCache: {
          find: jest.fn().mockResolvedValue(getTestRdcSession()),
        },
      },
      data: {
        id: "id",
      },
    };
  });

  test("should resolve with enrolment session status", async () => {
    await expect(getEnrolmentStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "pending",
      },
    });
  });

  test("should default to expired", async () => {
    ctx.cache.enrolmentSessionCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(getEnrolmentStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "expired",
      },
    });
  });
});
