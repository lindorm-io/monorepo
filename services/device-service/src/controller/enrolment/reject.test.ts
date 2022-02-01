import { getTestEnrolmentSession } from "../../test/entity";
import { rejectEnrolmentController } from "./reject";

describe("rejectEnrolmentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        enrolmentSessionCache: {
          destroy: jest.fn(),
        },
      },
      entity: {
        enrolmentSession: getTestEnrolmentSession(),
      },
    };
  });

  test("should resolve with removed session", async () => {
    await expect(rejectEnrolmentController(ctx)).resolves.toBeTruthy();

    expect(ctx.cache.enrolmentSessionCache.destroy).toHaveBeenCalled();
  });
});
