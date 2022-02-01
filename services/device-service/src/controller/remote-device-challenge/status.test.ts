import { EntityNotFoundError } from "@lindorm-io/entity";
import { getRdcSessionStatusController } from "./status";
import { getTestRdcSession } from "../../test/entity";

describe("getRdcSessionStatusController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        rdcSessionCache: {
          find: jest.fn().mockResolvedValue(getTestRdcSession()),
        },
      },
      data: {
        id: "id",
      },
    };
  });

  test("should resolve with rdc session status", async () => {
    await expect(getRdcSessionStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "pending",
      },
    });
  });

  test("should default to expired", async () => {
    ctx.cache.rdcSessionCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(getRdcSessionStatusController(ctx)).resolves.toStrictEqual({
      body: {
        status: "expired",
      },
    });
  });
});
