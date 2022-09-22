import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { confirmElevationController } from "./confirm-elevation";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestElevationSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("confirmElevationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        elevationSessionCache: createMockCache(createTestElevationSession),
      },
      data: {
        acrValues: ["loa_3"],
        amrValues: ["email", "phone"],
        identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
        levelOfAssurance: 3,
      },
      entity: {
        elevationSession: createTestElevationSession({
          identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
        }),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(confirmElevationController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.elevationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedAuthentication: {
          acrValues: ["loa_3"],
          amrValues: ["email", "phone"],
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 3,
        },
        status: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should throw on invalid identity", async () => {
    ctx.data.identityId = "wrong";

    await expect(confirmElevationController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid level", async () => {
    ctx.data.levelOfAssurance = 1;

    await expect(confirmElevationController(ctx)).rejects.toThrow(ClientError);
  });
});
