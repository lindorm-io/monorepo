import { EntityNotFoundError } from "@lindorm-io/entity";
import { SessionStatus } from "../../common";
import { getFlowStatusController } from "./get-flow-status";
import { getTestFlowSession } from "../../test/entity";

describe("getFlowStatusController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        flowSessionCache: {
          find: jest.fn().mockResolvedValue(getTestFlowSession()),
        },
      },
      data: { id: "id" },
    };
  });

  test("should resolve", async () => {
    await expect(getFlowStatusController(ctx)).resolves.toStrictEqual({
      body: { status: SessionStatus.PENDING },
    });
  });

  test("should resolve expired when flow cannot be found", async () => {
    ctx.cache.flowSessionCache.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(getFlowStatusController(ctx)).resolves.toStrictEqual({
      body: { status: SessionStatus.EXPIRED },
    });
  });
});
