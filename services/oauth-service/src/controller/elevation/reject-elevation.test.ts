import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestElevationRequest } from "../../fixtures/entity";
import {
  assertSessionPending as _assertSessionPending,
  createElevationRejectedUri as _createElevationRejectedUri,
} from "../../util";
import { rejectElevationController } from "./reject-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const assertSessionPending = _assertSessionPending as jest.Mock;
const createElevationRejectedUri = _createElevationRejectedUri as jest.Mock;

describe("rejectElevationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        elevationRequestCache: createMockRedisRepository(createTestElevationRequest),
      },
      entity: {
        elevationRequest: createTestElevationRequest(),
      },
      logger: createMockLogger(),
    };

    assertSessionPending.mockImplementation();
    createElevationRejectedUri.mockReturnValue("createElevationRejectedUri");
  });

  test("should resolve", async () => {
    await expect(rejectElevationController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createElevationRejectedUri" },
    });

    expect(ctx.redis.elevationRequestCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });

  test("should resolve without redirect", async () => {
    ctx.entity.elevationRequest = createTestElevationRequest({ redirectUri: null });

    await expect(rejectElevationController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.elevationRequestCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });
});
